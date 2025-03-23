# Friday AI Assistant

<div align="center">
  <img src="https://raw.githubusercontent.com/gruntcode/friday-ai-assistant/main/static/images/friday-avatar.png" alt="Friday AI Assistant" >
</div>

A modern web application featuring an AI assistant named "Friday" with a futuristic UI and voice capabilities.

## Features

- Chat with Friday, powered by advanced language models from Groq
- Voice input and output capabilities using Web Speech API and OpenAI TTS
- Web search capability for up-to-date information
- PDF generation for saving and sharing conversations
- Theme switching between dark and light modes
- Response caching for improved performance

## Available Models

- Llama 3.1 8B Instant - Fast, efficient model for quick responses
- DeepSeek R1 Distill Llama 70B - Powerful distilled model with strong capabilities
- Llama 3.2 11B Vision Preview - Model with vision capabilities
- Llama 3.3 70B Versatile - Highest quality large model for complex tasks

## Setup

1. Clone the repository:

   ```bash
   git clone https://github.com/gruntcode/friday-ai-assistant.git
   cd friday-ai-assistant
   ```

2. Install dependencies:

   ```bash
   pip install -r requirements.txt
   ```

3. Create a `.env` file in the root directory with your API keys:

   ```bash
   GROQ_API_KEY=your_groq_api_key_here
   OPENAI_API_KEY=your_openai_api_key_here
   ```

4. Run the application:

   ```bash
   python app.py
   ```

5. Open your browser and navigate to `http://localhost:5000`

## Getting API Keys

### Groq API Key

1. Sign up for an account at [Groq Console](https://console.groq.com/)
2. Navigate to the API Keys section
3. Create a new API key
4. Copy the key and add it to your `.env` file

### OpenAI API Key (for TTS functionality)

1. Sign up for an account at [OpenAI Platform](https://platform.openai.com/)
2. Navigate to the API Keys section
3. Create a new API key
4. Copy the key and add it to your `.env` file

## Usage

- **Chat**: Type your message in the input box and press Enter or click the send button
- **Voice Input**: Click the microphone button and speak your message
- **Voice Output**: Toggle the voice button in the header to enable/disable voice responses
- **Web Search**: Toggle the search button to enable web search capabilities
- **PDF Generation**: Toggle the PDF button to generate a PDF of the conversation
- **Theme Switching**: Click the theme button to switch between dark and light modes
- **Model Selection**: Choose your preferred AI model from the dropdown menu

## Project Structure

- `app.py` - Main Flask application with API endpoints
- `templates/` - HTML templates for the web interface
- `static/` - CSS, JavaScript, and static assets
- `static/audio/` - Directory for storing generated voice responses
- `static/downloads/` - Directory for storing generated PDFs

## Requirements

- Python 3.8+
- Groq API key
- OpenAI API key (for TTS functionality)
- Modern web browser with JavaScript enabled

## License

MIT License
