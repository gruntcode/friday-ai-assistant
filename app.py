import os
import json
import requests
import hashlib
import time
from collections import defaultdict
from flask import Flask, request, jsonify, render_template, send_from_directory, redirect, url_for, flash
from flask_cors import CORS
import groq
import io
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Image, Table, TableStyle
from bs4 import BeautifulSoup
from dotenv import load_dotenv
import re
import datetime
import openai

# Load environment variables from .env file
load_dotenv()

app = Flask(__name__, static_folder='static')
app.secret_key = os.environ.get("SECRET_KEY", os.urandom(24))
CORS(app)

# Get API keys from environment variables
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

if not GROQ_API_KEY:
    print("Warning: GROQ_API_KEY not found in environment variables. Please set it up.")

if not OPENAI_API_KEY:
    print("Warning: OPENAI_API_KEY not found in environment variables. Please set it up.")

# Initialize Groq client
groq_client = groq.Groq(api_key=GROQ_API_KEY)

# Initialize OpenAI client
openai_client = openai.OpenAI(api_key=OPENAI_API_KEY)

# Configure Groq client
client = None

# Initialize Groq client if API key is available
if GROQ_API_KEY:
    client = groq.Client(api_key=GROQ_API_KEY)

# Create downloads directory if it doesn't exist
os.makedirs(os.path.join(app.static_folder, 'downloads'), exist_ok=True)

# Create cache directory if it doesn't exist
cache_dir = os.path.join(app.static_folder, 'cache')
os.makedirs(cache_dir, exist_ok=True)

# Create audio directory if it doesn't exist
audio_dir = os.path.join(app.static_folder, 'audio')
os.makedirs(audio_dir, exist_ok=True)

# Simple in-memory cache with TTL
response_cache = {}
CACHE_TTL = 3600  # Cache TTL in seconds (1 hour)
MAX_CACHE_SIZE = 100  # Maximum number of items in cache

# Rate limiting configuration
RATE_LIMIT_WINDOW = 60  # 60 seconds (1 minute)
RATE_LIMIT_MAX_REQUESTS = 10  # Maximum 10 requests per minute
rate_limit_data = defaultdict(list)

def apply_rate_limit(ip_address):
    """Apply rate limiting based on IP address."""
    current_time = time.time()
    
    # Remove timestamps older than the window
    rate_limit_data[ip_address] = [
        timestamp for timestamp in rate_limit_data[ip_address]
        if current_time - timestamp < RATE_LIMIT_WINDOW
    ]
    
    # Check if rate limit is exceeded
    if len(rate_limit_data[ip_address]) >= RATE_LIMIT_MAX_REQUESTS:
        return False
    
    # Add current timestamp
    rate_limit_data[ip_address].append(current_time)
    return True

def get_cache_key(messages, model):
    """Generate a cache key from messages and model."""
    # Only use the last user message for the cache key
    last_user_message = None
    for msg in reversed(messages):
        if msg.get('role') == 'user':
            last_user_message = msg.get('content')
            break
    
    if not last_user_message:
        return None
    
    # Create a hash from the last user message and model
    key_data = f"{last_user_message.lower().strip()}:{model}"
    return hashlib.md5(key_data.encode()).hexdigest()

def get_from_cache(cache_key):
    """Get response from cache if it exists and is not expired."""
    if not cache_key or cache_key not in response_cache:
        return None
    
    cache_item = response_cache[cache_key]
    if time.time() - cache_item['timestamp'] > CACHE_TTL:
        # Cache expired, remove it
        del response_cache[cache_key]
        return None
    
    return cache_item['response']

def add_to_cache(cache_key, response):
    """Add response to cache with timestamp."""
    if not cache_key:
        return
    
    # If cache is full, remove oldest item
    if len(response_cache) >= MAX_CACHE_SIZE:
        oldest_key = min(response_cache.keys(), key=lambda k: response_cache[k]['timestamp'])
        del response_cache[oldest_key]
    
    response_cache[cache_key] = {
        'response': response,
        'timestamp': time.time()
    }

@app.route('/')
def index():
    if not GROQ_API_KEY:
        return render_template('setup.html')
    return render_template('index.html')

@app.route('/setup', methods=['POST'])
def setup():
    api_key = request.form.get('api_key')
    if not api_key:
        flash('API Key is required', 'error')
        return redirect(url_for('index'))
    
    # Test the API key
    try:
        test_client = groq.Client(api_key=api_key)
        # Simple test request
        test_client.chat.completions.create(
            messages=[{"role": "user", "content": "Hello"}],
            model="llama-3.1-8b-instant",
            max_tokens=10,
        )
        
        # Save to .env file
        with open('.env', 'w') as f:
            f.write(f"GROQ_API_KEY={api_key}\n")
        
        # Update current session
        global GROQ_API_KEY, client
        GROQ_API_KEY = api_key
        client = groq.Client(api_key=GROQ_API_KEY)
        
        flash('API Key saved successfully', 'success')
        return redirect(url_for('index'))
    except Exception as e:
        flash(f'Invalid API Key: {str(e)}', 'error')
        return redirect(url_for('index'))

@app.route('/api/chat', methods=['POST'])
def chat():
    # Check if API key is configured
    if not GROQ_API_KEY or not client:
        return jsonify({"error": "API Key not configured. Please set up your API key first."}), 401
    
    # Apply rate limiting
    client_ip = request.remote_addr
    if not apply_rate_limit(client_ip):
        return jsonify({
            "error": f"Rate limit exceeded. Please wait before making more requests. Maximum {RATE_LIMIT_MAX_REQUESTS} requests per {RATE_LIMIT_WINDOW} seconds."
        }), 429
    
    data = request.json
    messages = data.get('messages', [])
    generate_pdf = data.get('generate_pdf', False)
    web_search = data.get('web_search', False)
    selected_model = data.get('model', "llama-3.1-8b-instant")
    use_cache = data.get('use_cache', True)  # Allow client to disable cache
    generate_voice = data.get('generate_voice', False)
    
    # Validate model selection
    valid_models = [
        "llama-3.1-8b-instant",
        "deepseek-r1-distill-llama-70b",
        "llama-3.2-11b-vision-preview",
        "llama-3.3-70b-versatile"
    ]
    
    if selected_model not in valid_models:
        selected_model = "llama-3.1-8b-instant"  # Default fallback
    
    # If web search is requested, perform search and add results to context
    web_search_results = ""
    if web_search:
        query = messages[-1]['content'].replace("search for ", "").replace("search ", "")
        web_search_results = perform_web_search(query)
        # Add search results to the context
        if web_search_results:
            messages.insert(-1, {
                "role": "system", 
                "content": f"Web search results for '{query}':\n\n{web_search_results}\n\nPlease use these results to inform your response."
            })
    
    # Add system message if not present
    if not any(msg.get('role') == 'system' for msg in messages):
        messages.insert(0, {
            "role": "system",
            "content": "You are Friday, an advanced AI assistant with a friendly and helpful personality. You provide concise, accurate information. When you don't know something, you admit it rather than making up information."
        })
    
    # Check cache if web search is not used and caching is enabled
    cache_key = None
    assistant_response = None
    
    if use_cache and not web_search and not generate_pdf and not generate_voice:
        cache_key = get_cache_key(messages, selected_model)
        assistant_response = get_from_cache(cache_key)
    
    if assistant_response:
        # Cache hit
        return jsonify({
            "response": assistant_response,
            "pdf_url": None,
            "audio_url": None,
            "web_search_performed": False,
            "cached": True
        })
    
    try:
        # Call the Groq API
        response = client.chat.completions.create(
            messages=messages,
            model=selected_model,
            temperature=0.7,
            max_tokens=2048,
        )
        
        assistant_response = response.choices[0].message.content
        
        # Add to cache if caching is enabled and no web search was performed
        if use_cache and not web_search and cache_key:
            add_to_cache(cache_key, assistant_response)
        
        # Generate PDF if requested
        pdf_url = None
        if generate_pdf:
            pdf_filename = f"friday_response_{int(time.time())}.pdf"
            pdf_path = os.path.join(app.static_folder, 'downloads', pdf_filename)
            create_pdf(assistant_response, pdf_path)
            pdf_url = f"/static/downloads/{pdf_filename}"
        
        # Generate audio if requested
        audio_url = None
        if generate_voice and OPENAI_API_KEY:
            try:
                timestamp = int(time.time())
                audio_filename = f"friday_voice_{timestamp}.mp3"
                audio_path = os.path.join(app.static_folder, 'audio', audio_filename)
                
                # Generate speech using OpenAI TTS
                response = openai_client.audio.speech.create(
                    model="tts-1",
                    voice="echo",
                    input=assistant_response
                )
                
                # Save the audio file
                response.stream_to_file(audio_path)
                audio_url = f"/static/audio/{audio_filename}"
            except Exception as e:
                print(f"Error generating voice: {str(e)}")
                audio_url = None
        
        return jsonify({
            "response": assistant_response,
            "pdf_url": pdf_url,
            "audio_url": audio_url,
            "web_search_performed": bool(web_search_results),
            "cached": False
        })
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/models', methods=['GET'])
def get_models():
    """Return available models for the dropdown."""
    models = [
        {"id": "llama-3.1-8b-instant", "name": "Llama 3.1 8B Instant"},
        {"id": "deepseek-r1-distill-llama-70b", "name": "DeepSeek R1 Distill Llama 70B"},
        {"id": "llama-3.2-11b-vision-preview", "name": "Llama 3.2 11B Vision Preview"},
        {"id": "llama-3.3-70b-versatile", "name": "Llama 3.3 70B Versatile"}
    ]
    return jsonify(models)

def perform_web_search(query):
    """Perform a basic web search and return the results."""
    try:
        # Using a search API (this is a simple example using DuckDuckGo)
        search_url = f"https://html.duckduckgo.com/html/?q={query}"
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
        }
        response = requests.get(search_url, headers=headers)
        
        if response.status_code == 200:
            soup = BeautifulSoup(response.text, 'html.parser')
            results = soup.find_all('div', class_='result')
            
            formatted_results = ""
            for i, result in enumerate(results[:5], 1):  # Limit to top 5 results
                title_elem = result.find('a', class_='result__a')
                snippet_elem = result.find('a', class_='result__snippet')
                
                if title_elem and snippet_elem:
                    title = title_elem.get_text(strip=True)
                    snippet = snippet_elem.get_text(strip=True)
                    formatted_results += f"{i}. {title}\n{snippet}\n\n"
            
            return formatted_results
        return "No search results found."
    except Exception as e:
        print(f"Search error: {e}")
        return f"Error performing web search: {str(e)}"

def create_pdf(content, output_path):
    """Create a well-styled PDF document from the assistant's response."""
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib import colors
    from reportlab.lib.units import inch
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Image, Table, TableStyle
    from reportlab.lib.pagesizes import letter
    import re
    import datetime
    
    # Set up the document
    doc = SimpleDocTemplate(
        output_path,
        pagesize=letter,
        leftMargin=0.5*inch,
        rightMargin=0.5*inch,
        topMargin=0.5*inch,
        bottomMargin=0.5*inch
    )
    
    # Create custom styles
    styles = getSampleStyleSheet()
    
    # Add custom styles
    styles.add(ParagraphStyle(
        name='FridayTitle',
        parent=styles['Heading1'],
        fontSize=24,
        textColor=colors.HexColor('#00e5ff'),
        spaceAfter=16,
        alignment=1  # Center alignment
    ))
    
    styles.add(ParagraphStyle(
        name='FridaySubtitle',
        parent=styles['Heading2'],
        fontSize=14,
        textColor=colors.HexColor('#888888'),
        spaceAfter=20,
        alignment=1  # Center alignment
    ))
    
    styles.add(ParagraphStyle(
        name='FridayHeading2',
        parent=styles['Heading2'],
        fontSize=16,
        textColor=colors.HexColor('#00e5ff'),
        spaceBefore=12,
        spaceAfter=6
    ))
    
    styles.add(ParagraphStyle(
        name='FridayHeading3',
        parent=styles['Heading3'],
        fontSize=14,
        textColor=colors.HexColor('#00b8cc'),
        spaceBefore=10,
        spaceAfter=5
    ))
    
    styles.add(ParagraphStyle(
        name='FridayNormal',
        parent=styles['Normal'],
        fontSize=12,
        leading=16,
        spaceBefore=6,
        spaceAfter=6
    ))
    
    styles.add(ParagraphStyle(
        name='FridayCode',
        parent=styles['Normal'],
        fontName='Courier',
        fontSize=10,
        leading=14,
        spaceBefore=8,
        spaceAfter=8,
        backColor=colors.HexColor('#f0f0f0'),
        borderPadding=5,
        borderWidth=1,
        borderColor=colors.HexColor('#dddddd'),
        borderRadius=5
    ))
    
    styles.add(ParagraphStyle(
        name='FridayFooter',
        parent=styles['Normal'],
        fontSize=8,
        textColor=colors.HexColor('#888888'),
        alignment=1  # Center alignment
    ))
    
    # Start building the PDF content
    story = []
    
    # Add title
    story.append(Paragraph("Friday AI Assistant", styles['FridayTitle']))
    
    # Add date and time
    current_time = datetime.datetime.now().strftime("%B %d, %Y at %I:%M %p")
    story.append(Paragraph(f"Generated on {current_time}", styles['FridaySubtitle']))
    story.append(Spacer(1, 0.2*inch))
    
    # Clean up markdown syntax
    # Remove code blocks and replace with styled paragraphs
    def replace_code_block(match):
        code_content = match.group(1).strip()
        return f"<para style='FridayCode'>{code_content}</para>"
    
    # Process code blocks
    content = re.sub(r'```(?:.*?)\n([\s\S]*?)\n```', replace_code_block, content)
    
    # Process inline code
    content = re.sub(r'`([^`]+)`', r'<font face="Courier" color="#555555">\1</font>', content)
    
    # Process headings
    content = re.sub(r'^# (.*?)$', r'<para style="FridayHeading2">\1</para>', content, flags=re.MULTILINE)
    content = re.sub(r'^## (.*?)$', r'<para style="FridayHeading3">\1</para>', content, flags=re.MULTILINE)
    
    # Process bold and italic
    content = re.sub(r'\*\*(.*?)\*\*', r'<b>\1</b>', content)
    content = re.sub(r'\*(.*?)\*', r'<i>\1</i>', content)
    
    # Process bullet points
    content = re.sub(r'^\s*- (.*?)$', r'• \1', content, flags=re.MULTILINE)
    
    # Process links
    content = re.sub(r'\[(.*?)\]\((.*?)\)', r'<link href="\2">\1</link>', content)
    
    # Split by paragraphs and add to story
    paragraphs = content.split('\n\n')
    for para in paragraphs:
        if para.strip():
            if para.startswith('<para style='):
                # Extract style and content
                style_match = re.match(r'<para style=\'(.*?)\'>([\s\S]*?)</para>', para)
                if style_match:
                    style_name, para_content = style_match.groups()
                    story.append(Paragraph(para_content, styles[style_name]))
            else:
                # Regular paragraph
                story.append(Paragraph(para, styles['FridayNormal']))
    
    # Add footer
    story.append(Spacer(1, 0.5*inch))
    story.append(Paragraph("Powered by Friday AI Assistant", styles['FridayFooter']))
    
    # Build the PDF
    doc.build(story)
    return output_path

@app.route('/static/downloads/<path:filename>')
def download_file(filename):
    return send_from_directory(os.path.join(app.static_folder, 'downloads'), filename, as_attachment=True)

@app.route('/static/audio/<path:filename>')
def download_audio(filename):
    return send_from_directory(os.path.join(app.static_folder, 'audio'), filename, as_attachment=True)

if __name__ == '__main__':
    app.run(debug=True)
