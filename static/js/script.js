document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const chatContainer = document.getElementById('chat-container');
    const userInput = document.getElementById('user-input');
    const sendBtn = document.getElementById('send-btn');
    const newChatBtn = document.getElementById('new-chat-btn');
    const chatHistory = document.getElementById('chat-history');
    const webSearchToggle = document.getElementById('web-search-toggle');
    const pdfToggle = document.getElementById('pdf-toggle');
    const webSearchStatus = document.getElementById('web-search-status');
    const pdfStatus = document.getElementById('pdf-status');
    const webSearchIndicator = document.getElementById('web-search-indicator');
    const pdfIndicator = document.getElementById('pdf-indicator');
    const suggestionChips = document.querySelectorAll('.chip');
    const modelSelect = document.getElementById('model-select');
    const cacheToggle = document.getElementById('cache-toggle');
    const voiceButton = document.getElementById('voice-input-btn');
    const chatForm = document.getElementById('chat-form');
    const themeToggle = document.getElementById('theme-toggle');
    const voiceToggle = document.getElementById('voice-toggle');

    // State
    let messages = [];
    let chatId = generateId();
    let webSearchEnabled = false;
    let pdfEnabled = false;
    let voiceEnabled = false;
    let useCache = true;
    let selectedModel = "llama-3.1-8b-instant";
    let chats = JSON.parse(localStorage.getItem('friday_chats') || '[]');

    // Initialize SpeechRecognition
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    let recognition;

    if (SpeechRecognition) {
        recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.lang = 'en-US';
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;

        // Voice recognition event handlers
        recognition.onresult = function(event) {
            const transcript = event.results[0][0].transcript;
            userInput.value = transcript;
            voiceButton.classList.remove('listening');
            // Focus on input to allow user to edit if needed
            userInput.focus();
        };

        recognition.onerror = function(event) {
            console.error('Speech recognition error', event.error);
            voiceButton.classList.remove('listening');
            showNotification('Voice recognition error: ' + event.error, 'error');
        };

        recognition.onend = function() {
            voiceButton.classList.remove('listening');
        };

        // Voice button click handler
        voiceButton.addEventListener('click', function() {
            if (voiceButton.classList.contains('listening')) {
                recognition.stop();
                voiceButton.classList.remove('listening');
            } else {
                recognition.start();
                voiceButton.classList.add('listening');
                showNotification('Listening...', 'info');
            }
        });
    } else {
        voiceButton.style.display = 'none';
        console.log('Speech recognition not supported');
    }

    // Voice toggle event listener
    voiceToggle.addEventListener('change', function() {
        voiceEnabled = this.checked;
        const status = voiceEnabled ? 'ON' : 'OFF';
        showNotification(`Voice response ${status}`, 'info');
    });

    // Initialize
    loadChats();
    loadModels();
    adjustTextareaHeight(userInput);

    // Theme toggle
    themeToggle.addEventListener('change', function() {
        if (this.checked) {
            document.body.classList.add('light-theme');
            document.body.classList.remove('dark-theme');
            localStorage.setItem('friday_theme', 'light');
            showNotification('Light theme activated', 'info');
        } else {
            document.body.classList.add('dark-theme');
            document.body.classList.remove('light-theme');
            localStorage.setItem('friday_theme', 'dark');
            showNotification('Dark theme activated', 'info');
        }
    });

    // Load saved theme preference
    const savedTheme = localStorage.getItem('friday_theme');
    if (savedTheme === 'light') {
        themeToggle.checked = true;
        document.body.classList.add('light-theme');
        document.body.classList.remove('dark-theme');
    } else {
        themeToggle.checked = false;
        document.body.classList.add('dark-theme');
        document.body.classList.remove('light-theme');
    }

    // Event Listeners
    userInput.addEventListener('input', () => {
        adjustTextareaHeight(userInput);
    });

    userInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    chatForm.addEventListener('submit', function(e) {
        e.preventDefault();
        sendMessage();
    });

    sendBtn.addEventListener('click', sendMessage);

    newChatBtn.addEventListener('click', () => {
        startNewChat();
    });

    webSearchToggle.addEventListener('click', () => {
        webSearchEnabled = !webSearchEnabled;
        webSearchToggle.classList.toggle('active', webSearchEnabled);
        webSearchStatus.textContent = webSearchEnabled ? 'ON' : 'OFF';
        webSearchIndicator.classList.toggle('active', webSearchEnabled);
    });

    pdfToggle.addEventListener('click', () => {
        pdfEnabled = !pdfEnabled;
        pdfToggle.classList.toggle('active', pdfEnabled);
        pdfStatus.textContent = pdfEnabled ? 'ON' : 'OFF';
        pdfIndicator.classList.toggle('active', pdfEnabled);
    });

    cacheToggle.addEventListener('change', () => {
        useCache = cacheToggle.checked;
        // Show notification about cache setting
        const message = useCache
            ? 'Response caching enabled. Similar questions will be answered faster.'
            : 'Response caching disabled. All questions will be processed by the AI model.';

        showSystemNotification(message);
    });

    if (modelSelect) {
        modelSelect.addEventListener('change', (e) => {
            selectedModel = e.target.value;
            // Show model change notification
            const modelName = modelSelect.options[modelSelect.selectedIndex].text;
            showModelChangeNotification(modelName);
        });
    }

    // Handle suggestion chips
    suggestionChips.forEach(chip => {
        chip.addEventListener('click', function() {
            userInput.value = this.textContent;
            adjustTextareaHeight(userInput);
            sendMessage();
        });
    });

    // Functions
    function loadModels() {
        if (!modelSelect) return;

        fetch('/api/models')
            .then(response => response.json())
            .then(models => {
                // Clear existing options
                modelSelect.innerHTML = '';

                // Add models to dropdown
                models.forEach(model => {
                    const option = document.createElement('option');
                    option.value = model.id;
                    option.text = model.name;
                    option.title = model.description;
                    modelSelect.appendChild(option);
                });

                // Set default model
                modelSelect.value = selectedModel;
            })
            .catch(error => {
                console.error('Error loading models:', error);
            });
    }

    function showModelChangeNotification(modelName) {
        // Create system message to indicate model change
        const messageDiv = document.createElement('div');
        messageDiv.className = 'system-notification';
        messageDiv.innerHTML = `<i class="fas fa-sync-alt"></i> Switched to <strong>${modelName}</strong>`;

        chatContainer.appendChild(messageDiv);
        chatContainer.scrollTop = chatContainer.scrollHeight;

        // Remove after a few seconds
        setTimeout(() => {
            messageDiv.classList.add('fade-out');
            setTimeout(() => {
                messageDiv.remove();
            }, 500);
        }, 3000);
    }

    function sendMessage() {
        const userMessage = userInput.value.trim();
        if (!userMessage) return;

        // Add user message to UI
        addMessageToUI('user', userMessage);

        // Add to messages array
        messages.push({
            role: 'user',
            content: userMessage
        });

        // Clear input
        userInput.value = '';
        adjustTextareaHeight(userInput);

        // Show typing indicator
        showTypingIndicator();

        // Send to API
        fetch('/api/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                messages: messages,
                generate_pdf: pdfEnabled,
                web_search: webSearchEnabled,
                generate_voice: voiceEnabled,
                use_cache: useCache,
                model: selectedModel
            })
        })
        .then(response => response.json())
        .then(data => {
            // Remove typing indicator
            removeTypingIndicator();

            if (data.error) {
                addErrorMessageToUI(data.error);
                return;
            }

            // Add assistant response to UI
            const messageElement = addMessageToUI('assistant', data.response, data.pdf_url, data.web_search_performed, data.cached);

            // Handle audio playback if available
            if (data.audio_url) {
                const audioPlayer = document.createElement('audio');
                audioPlayer.controls = true;
                audioPlayer.className = 'tts-audio';
                
                const audioSource = document.createElement('source');
                audioSource.src = data.audio_url;
                audioSource.type = 'audio/mpeg';
                
                audioPlayer.appendChild(audioSource);
                messageElement.querySelector('.message-content').appendChild(audioPlayer);
                
                // Auto-play the audio
                audioPlayer.play().catch(e => {
                    console.log('Auto-play prevented:', e);
                    showNotification('Click play to hear Friday\'s voice', 'info');
                });
            }

            // Add to messages array
            messages.push({
                role: 'assistant',
                content: data.response
            });

            // Save chat
            saveChat();
        })
        .catch(error => {
            console.error('Error:', error);
            removeTypingIndicator();
            addErrorMessageToUI('Sorry, I encountered an error. Please try again.');
        });
    }

    function addErrorMessageToUI(errorMessage) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'system-error';
        messageDiv.innerHTML = `<i class="fas fa-exclamation-triangle"></i> ${errorMessage}`;

        chatContainer.appendChild(messageDiv);
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }

    function addMessageToUI(role, content, pdfUrl = null, webSearchPerformed = false, fromCache = false) {
        // Remove welcome message if it exists
        const welcomeMessage = document.querySelector('.welcome-message');
        if (welcomeMessage) {
            welcomeMessage.remove();
        }

        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${role}`;

        const avatarDiv = document.createElement('div');
        avatarDiv.className = 'message-avatar';

        const avatarIcon = document.createElement('i');
        avatarIcon.className = role === 'user' ? 'fas fa-user' : 'fas fa-robot';
        avatarDiv.appendChild(avatarIcon);

        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';

        // Add web search info if performed
        if (webSearchPerformed && role === 'assistant') {
            const webSearchInfo = document.createElement('div');
            webSearchInfo.className = 'web-search-info';
            webSearchInfo.innerHTML = '<i class="fas fa-globe"></i> Web search results included';
            contentDiv.appendChild(webSearchInfo);
        }

        // Add cache info if response is from cache
        if (fromCache && role === 'assistant') {
            const cacheInfo = document.createElement('div');
            cacheInfo.className = 'cache-info';
            cacheInfo.innerHTML = '<i class="fas fa-bolt"></i> Cached response';
            contentDiv.appendChild(cacheInfo);
        }

        const textDiv = document.createElement('div');
        textDiv.className = 'message-text';

        // Format message with markdown-like syntax
        const formattedContent = formatMessage(content);
        textDiv.innerHTML = formattedContent;

        contentDiv.appendChild(textDiv);

        // Add time
        const timeDiv = document.createElement('div');
        timeDiv.className = 'message-time';
        timeDiv.textContent = getCurrentTime();
        contentDiv.appendChild(timeDiv);

        // Add model info for assistant messages
        if (role === 'assistant') {
            const modelInfo = document.createElement('div');
            modelInfo.className = 'model-info';
            const modelName = modelSelect ? modelSelect.options[modelSelect.selectedIndex].text : 'Llama 3.1 8B Instant';
            modelInfo.innerHTML = `<i class="fas fa-microchip"></i> ${modelName}`;
            contentDiv.appendChild(modelInfo);
        }

        // Add PDF download link if available
        if (pdfUrl) {
            const pdfLink = document.createElement('a');
            pdfLink.href = pdfUrl;
            pdfLink.className = 'pdf-download';
            pdfLink.innerHTML = '<i class="fas fa-file-pdf"></i> Download PDF';
            pdfLink.setAttribute('download', '');
            contentDiv.appendChild(pdfLink);
        }

        messageDiv.appendChild(role === 'user' ? avatarDiv : contentDiv);
        messageDiv.appendChild(role === 'user' ? contentDiv : avatarDiv);

        chatContainer.appendChild(messageDiv);

        // Scroll to bottom
        chatContainer.scrollTop = chatContainer.scrollHeight;

        // If this is the first message in a new chat, add to chat history
        if (messages.length === 1 && role === 'user') {
            addChatToHistory(chatId, content);
        }

        return messageDiv;
    }

    function formatMessage(content) {
        // Replace code blocks
        content = content.replace(/```([a-z]*)\n([\s\S]*?)\n```/g, '<pre><code class="language-$1">$2</code></pre>');

        // Replace inline code
        content = content.replace(/`([^`]+)`/g, '<code>$1</code>');

        // Replace bold text
        content = content.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

        // Replace italic text
        content = content.replace(/\*([^*]+)\*/g, '<em>$1</em>');

        // Replace links
        content = content.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');

        // Replace newlines with <br>
        content = content.replace(/\n/g, '<br>');

        return content;
    }

    function showTypingIndicator() {
        const typingDiv = document.createElement('div');
        typingDiv.className = 'message assistant typing';

        const avatarDiv = document.createElement('div');
        avatarDiv.className = 'message-avatar';

        const avatarIcon = document.createElement('i');
        avatarIcon.className = 'fas fa-robot';
        avatarDiv.appendChild(avatarIcon);

        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';

        const typingIndicator = document.createElement('div');
        typingIndicator.className = 'typing-indicator';

        for (let i = 0; i < 3; i++) {
            const dot = document.createElement('div');
            dot.className = 'typing-dot';
            typingIndicator.appendChild(dot);
        }

        contentDiv.appendChild(typingIndicator);

        typingDiv.appendChild(contentDiv);
        typingDiv.appendChild(avatarDiv);

        chatContainer.appendChild(typingDiv);
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }

    function removeTypingIndicator() {
        const typingIndicator = document.querySelector('.typing');
        if (typingIndicator) {
            typingIndicator.remove();
        }
    }

    function getCurrentTime() {
        const now = new Date();
        return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    function adjustTextareaHeight(textarea) {
        textarea.style.height = 'auto';
        textarea.style.height = (textarea.scrollHeight) + 'px';
    }

    function generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    function startNewChat() {
        // Clear messages
        messages = [];
        chatId = generateId();

        // Clear chat container
        chatContainer.innerHTML = `
            <div class="welcome-message">
                <div class="welcome-icon">
                    <i class="fas fa-robot"></i>
                </div>
                <h2>Hello, I'm Friday</h2>
                <p>Your personal AI assistant with a futuristic touch. How can I help you today?</p>
                <div class="suggestion-chips">
                    <div class="chip" data-text="Tell me about yourself">Tell me about yourself</div>
                    <div class="chip" data-text="What can you do?">What can you do?</div>
                    <div class="chip" data-text="Search for the latest AI news">Search for the latest AI news</div>
                </div>
            </div>
        `;

        // Reattach event listeners to chips
        document.querySelectorAll('.chip').forEach(chip => {
            chip.addEventListener('click', () => {
                userInput.value = chip.dataset.text;
                adjustTextareaHeight(userInput);
                sendMessage();
            });
        });
    }

    function saveChat() {
        if (messages.length < 2) return;

        const existingChatIndex = chats.findIndex(chat => chat.id === chatId);
        const chatTitle = messages[0].content.substring(0, 30) + (messages[0].content.length > 30 ? '...' : '');

        if (existingChatIndex !== -1) {
            chats[existingChatIndex].title = chatTitle;
            chats[existingChatIndex].messages = messages;
            chats[existingChatIndex].timestamp = Date.now();
        } else {
            chats.push({
                id: chatId,
                title: chatTitle,
                messages: messages,
                timestamp: Date.now()
            });
        }

        // Sort chats by timestamp (newest first)
        chats.sort((a, b) => b.timestamp - a.timestamp);

        // Save to localStorage
        localStorage.setItem('friday_chats', JSON.stringify(chats));

        // Update chat history UI
        loadChats();
    }

    function loadChats() {
        chatHistory.innerHTML = '';

        chats.forEach(chat => {
            const chatItem = document.createElement('div');
            chatItem.className = 'chat-item';
            chatItem.dataset.id = chat.id;

            chatItem.innerHTML = `
                <i class="fas fa-comment"></i>
                <div class="chat-item-title">${chat.title}</div>
                <div class="chat-item-delete"><i class="fas fa-trash"></i></div>
            `;

            chatItem.addEventListener('click', (e) => {
                if (e.target.closest('.chat-item-delete')) {
                    deleteChat(chat.id);
                } else {
                    loadChat(chat.id);
                }
            });

            chatHistory.appendChild(chatItem);
        });
    }

    function loadChat(id) {
        const chat = chats.find(chat => chat.id === id);
        if (!chat) return;

        chatId = chat.id;
        messages = [...chat.messages];

        // Clear chat container
        chatContainer.innerHTML = '';

        // Add messages to UI
        messages.forEach(message => {
            addMessageToUI(message.role, message.content);
        });

        // Highlight active chat
        document.querySelectorAll('.chat-item').forEach(item => {
            item.classList.toggle('active', item.dataset.id === id);
        });
    }

    function deleteChat(id) {
        chats = chats.filter(chat => chat.id !== id);
        localStorage.setItem('friday_chats', JSON.stringify(chats));
        loadChats();

        if (chatId === id) {
            startNewChat();
        }
    }

    function addChatToHistory(id, title) {
        const chatItem = document.createElement('div');
        chatItem.className = 'chat-item active';
        chatItem.dataset.id = id;

        chatItem.innerHTML = `
            <i class="fas fa-comment"></i>
            <div class="chat-item-title">${title.substring(0, 30)}${title.length > 30 ? '...' : ''}</div>
            <div class="chat-item-delete"><i class="fas fa-trash"></i></div>
        `;

        chatItem.addEventListener('click', (e) => {
            if (e.target.closest('.chat-item-delete')) {
                deleteChat(id);
            } else {
                loadChat(id);
            }
        });

        // Remove active class from all chat items
        document.querySelectorAll('.chat-item').forEach(item => {
            item.classList.remove('active');
        });

        // Add to chat history
        chatHistory.prepend(chatItem);
    }

    function showSystemNotification(message) {
        const notificationDiv = document.createElement('div');
        notificationDiv.className = 'system-notification';
        notificationDiv.innerHTML = `<i class="fas fa-info-circle"></i> ${message}`;
        chatContainer.appendChild(notificationDiv);
        chatContainer.scrollTop = chatContainer.scrollHeight;

        // Auto-remove after 3 seconds
        setTimeout(() => {
            notificationDiv.classList.add('fade-out');
            setTimeout(() => {
                notificationDiv.remove();
            }, 500);
        }, 3000);
    }

    function showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <i class="fas ${type === 'error' ? 'fa-exclamation-circle' : type === 'success' ? 'fa-check-circle' : 'fa-info-circle'}"></i>
                <span>${message}</span>
            </div>
        `;

        document.body.appendChild(notification);

        // Animate in
        setTimeout(() => {
            notification.classList.add('show');
        }, 10);

        // Remove after delay
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => {
                notification.remove();
            }, 300);
        }, 3000);
    }
});
