// Timer functionality
class EscapeRoomTimer {
    loadHintCodes() {
        // Load hint codes from HTML configuration
        const configElement = document.getElementById('hint-codes-config');
        if (configElement) {
            try {
                const config = JSON.parse(configElement.textContent);
                const codes = new Map();
                
                // Convert object to Map
                for (const [code, hintNumber] of Object.entries(config.codes)) {
                    codes.set(code, hintNumber);
                }
                
                console.log('Loaded hint codes:', codes);
                
                // Store hints mapping
                this.hints = config.hints || {};
                
                return codes;
            } catch (e) {
                console.error('Error parsing hint codes config:', e);
                return new Map();
            }
        }
        return new Map();
    }
    
    constructor() {
        this.isRunning = false;
        this.timerStarted = false; // Track if timer is started (even if stopped)
        this.timerReset = false; // Track if timer has been reset
        this.startTime = null;
        this.totalTime = 90 * 60 * 1000; // 1 hour 30 minutes in milliseconds
        this.timeLeft = this.totalTime; // Time remaining
        this.elapsedTime = 0; // Time elapsed
        this.timerInterval = null;
        this.currentCode = '';
        this.maxCodeLength = 4;
        this.tapCount = 0;
        this.tapTimeout = null;
        this.closeTapCount = 0;
        this.closeTapTimeout = null;
        this.queuedAction = null; // Store the action to execute when panel closes
        this.hintUsageCount = 0; // Track how many hints have been used
        this.passwordAttempt = ''; // Track password entry
        this.correctPassword = 'sh2025'; // Admin password
        
        // Load hint codes from HTML configuration
        this.hintCodes = this.loadHintCodes();
        
        this.initializeElements();
        this.setupEventListeners();
        this.updateCurrentTime();
        this.updateTimerDisplay();
        this.updateHintCounter();
        this.updateTimerStatus();
        this.updateButtonStates();
        this.updateProgressRing(); // Initialize progress ring
    }
    
    initializeElements() {
        this.timeDisplay = document.querySelector('.time-text');
        this.progressRing = document.querySelector('.progress-ring');
        this.codeBoxes = document.querySelectorAll('.code-box');
        this.keypadButtons = document.querySelectorAll('.key');
        this.currentTimeDisplay = document.querySelector('.current-time');
        this.popupOverlay = document.getElementById('popup-overlay');
        this.popupHint = document.getElementById('popup-hint');
        this.popupCloseButton = document.getElementById('popup-close-button');
        this.adminPanel = document.getElementById('admin-panel');
        this.timerStatus = document.getElementById('timer-status');
        this.startTimerBtn = document.getElementById('start-timer-btn');
        this.stopTimerBtn = document.getElementById('stop-timer-btn');
        this.resetTimerBtn = document.getElementById('reset-timer-btn');
        this.timerSection = document.querySelector('.timer-section');
        this.hintCounter = document.querySelector('.hint-counter');
        this.passwordInput = document.getElementById('admin-password-input');
        this.submitPasswordBtn = document.getElementById('submit-password-btn');
        this.passwordSection = document.getElementById('admin-password-section');
        this.controlsSection = document.getElementById('admin-controls-section');
        this.appTitle = document.querySelector('.app-title');
    }
    
    setupEventListeners() {
        // Keypad buttons
        this.keypadButtons.forEach(button => {
            button.addEventListener('click', () => {
                const number = button.dataset.number;
                this.addDigitToCode(number);
            });
        });
        
        // Update current time every minute
        setInterval(() => {
            this.updateCurrentTime();
        }, 60000);
        
        // Close popup when clicking the close button
        if (this.popupCloseButton) {
            this.popupCloseButton.addEventListener('click', (e) => {
                e.stopPropagation();
                this.hideHint();
            });
            
            // Also handle touch events for better mobile support
            this.popupCloseButton.addEventListener('touchend', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.hideHint();
            });
        }
        
        // Triple tap on app title to show admin panel (only when admin panel is hidden)
        this.appTitle.addEventListener('click', (e) => {
            if (!this.adminPanel.classList.contains('show')) {
                this.handleTripleTap();
            }
        });
        
        this.appTitle.addEventListener('touchend', (e) => {
            if (!this.adminPanel.classList.contains('show')) {
                e.preventDefault();
                this.handleTripleTap();
            }
        });
        
        // Admin panel buttons - different behaviors for each button
        this.startTimerBtn.addEventListener('click', (e) => {
            console.log('Start button clicked');
            e.stopPropagation();
            if (this.startTimerBtn.disabled) return; // Don't do anything if disabled
            
            if (this.queuedAction === 'start') {
                // If already queued, unqueue it
                this.queuedAction = null;
                this.updateButtonStyles(null);
                this.updateButtonStates();
                this.updateTimerStatus();
            } else {
                // Queue start action
                this.queueAction('start');
                this.updateButtonStates();
                this.updateTimerStatus();
            }
        });
        
        this.stopTimerBtn.addEventListener('click', (e) => {
            console.log('Stop button clicked');
            e.stopPropagation();
            if (this.stopTimerBtn.disabled) return; // Don't do anything if disabled
            this.stopTimer(); // Execute immediately
        });
        
        this.resetTimerBtn.addEventListener('click', (e) => {
            console.log('Reset button clicked');
            e.stopPropagation();
            if (this.resetTimerBtn.disabled) return; // Don't do anything if disabled
            this.resetTimer(); // Execute immediately
        });
        
        // Close admin panel with triple tap (only when admin panel is visible)
        this.adminPanel.addEventListener('click', (e) => {
            // Only trigger if clicking directly on the admin panel background, not on any content
            if (e.target === this.adminPanel && this.adminPanel.classList.contains('show')) {
                this.handleTripleTapClose();
            }
        });
        
        this.adminPanel.addEventListener('touchend', (e) => {
            // Only trigger if touching directly on the admin panel background, not on any content
            if (e.target === this.adminPanel && this.adminPanel.classList.contains('show')) {
                e.preventDefault();
                this.handleTripleTapClose();
            }
        });
        
        document.addEventListener('keydown', (e) => {
            if (this.popupOverlay.classList.contains('show')) {
                // Allow Escape key to close the popup
                if (e.key === 'Escape') {
                    this.hideHint();
                }
            } else if (e.key >= '1' && e.key <= '9') {
                const keyButton = document.querySelector(`[data-number="${e.key}"]`);
                if (keyButton) {
                    keyButton.click();
                }
            }
        });
        
        // Set up password submission handlers
        this.handlePasswordSubmission();
    }
    
    handleTripleTap() {
        this.tapCount++;
        console.log('Timer tap count:', this.tapCount); // Debug log
        
        if (this.tapCount === 3) {
            this.toggleAdminPanel();
            this.tapCount = 0;
        }
        
        // Reset tap count after 800ms (shorter timeout)
        clearTimeout(this.tapTimeout);
        this.tapTimeout = setTimeout(() => {
            this.tapCount = 0;
        }, 800);
    }
    
    handleTripleTapClose() {
        this.closeTapCount++;
        console.log('Close tap count:', this.closeTapCount); // Debug log
        
        if (this.closeTapCount === 3) {
            this.adminPanel.classList.remove('show');
            this.closeTapCount = 0;
            // Clear code input when admin panel closes
            this.resetCode();
            // Execute queued action when admin panel closes
            this.executeQueuedAction();
        }
        
        // Reset tap count after 800ms (shorter timeout)
        clearTimeout(this.closeTapTimeout);
        this.closeTapTimeout = setTimeout(() => {
            this.closeTapCount = 0;
        }, 800);
    }
    
    queueAction(action) {
        this.queuedAction = action;
        console.log('Queued action:', action); // Debug log
        
        // Update button styles to show which action is queued
        this.updateButtonStyles(action);
    }
    
    updateButtonStyles(queuedAction) {
        // Reset all button styles
        this.startTimerBtn.style.background = 'transparent';
        this.startTimerBtn.style.color = '#ff6b6b';
        this.stopTimerBtn.style.background = 'transparent';
        this.stopTimerBtn.style.color = '#ff6b6b';
        this.resetTimerBtn.style.background = 'transparent';
        this.resetTimerBtn.style.color = '#ff6b6b';
        
        // Only highlight the start button if it's queued (other buttons execute immediately)
        if (queuedAction === 'start') {
            this.startTimerBtn.style.background = '#ff6b6b';
            this.startTimerBtn.style.color = 'black';
        }
    }
    
    executeQueuedAction() {
        if (this.queuedAction) {
            console.log('Executing queued action:', this.queuedAction); // Debug log
            
            // Only execute start action (stop and reset execute immediately)
            if (this.queuedAction === 'start') {
                this.startTimer();
                this.timerStarted = true;
                this.updateTimerStatus();
                this.updateButtonStates();
                // Clear the queued action and reset button styles after starting
                this.queuedAction = null;
                this.updateButtonStyles(null);
            }
            
            this.queuedAction = null; // Clear the queued action
        }
    }
    
    updateButtonStates() {
        // Enable/disable buttons based on timer state
        if (this.isRunning) {
            // 3. During status Running: Stop and Reset available, Start disabled
            this.startTimerBtn.disabled = true;
            this.stopTimerBtn.disabled = false;
            this.resetTimerBtn.disabled = false;
        } else if (this.queuedAction === 'start') {
            // During Started (queued) state: Start can be unqueued, Stop and Reset disabled
            this.startTimerBtn.disabled = false; // Can unqueue
            this.stopTimerBtn.disabled = true;
            this.resetTimerBtn.disabled = true;
        } else if (this.timerReset) {
            // 1. Initial Reset: Stop and Reset disabled
            this.startTimerBtn.disabled = false;
            this.stopTimerBtn.disabled = true;
            this.resetTimerBtn.disabled = true;
        } else {
            // 2. During status Stopped: All buttons enabled
            this.startTimerBtn.disabled = false;
            this.stopTimerBtn.disabled = false;
            this.resetTimerBtn.disabled = false;
        }
    }
    
    updateTimerStatus() {
        if (this.timerStatus) {
            if (this.timerStarted && this.isRunning) {
                this.timerStatus.textContent = '실행 중';
                this.timerStatus.style.color = '#4CAF50';
            } else if (this.timerStarted || this.queuedAction === 'start') {
                this.timerStatus.textContent = '시작됨';
                this.timerStatus.style.color = '#ffa500';
            } else if (this.timerReset) {
                this.timerStatus.textContent = '리셋됨';
                this.timerStatus.style.color = '#9b59b6';
            } else {
                this.timerStatus.textContent = '중지됨';
                this.timerStatus.style.color = '#ff6b6b';
            }
        }
    }
    
    toggleAdminPanel() {
        this.adminPanel.classList.add('show');
        // Reset password input
        if (this.passwordInput) {
            this.passwordInput.value = '';
        }
        // Show password section, hide controls
        if (this.passwordSection && this.controlsSection) {
            this.passwordSection.style.display = 'block';
            this.controlsSection.style.display = 'none';
        }
    }
    
    handlePasswordSubmission() {
        console.log('handlePasswordSubmission called');
        console.log('Elements:', {
            submitBtn: this.submitPasswordBtn,
            passwordInput: this.passwordInput
        });
        
        if (!this.submitPasswordBtn || !this.passwordInput) {
            console.error('Password elements not found');
            return;
        }
        
        console.log('Setting up password handlers');
        
        this.submitPasswordBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('Submit button clicked');
            this.checkPassword();
        });
        
        this.passwordInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                e.stopPropagation();
                console.log('Enter key pressed');
                this.checkPassword();
            }
        });
    }
    
    checkPassword() {
        const enteredPassword = this.passwordInput.value;
        console.log('Checking password:', enteredPassword);
        
        if (enteredPassword === this.correctPassword) {
            console.log('Password correct!');
            // Password correct - show controls
            this.passwordSection.style.display = 'none';
            this.controlsSection.style.display = 'block';
            this.passwordInput.value = '';
        } else {
            console.log('Password incorrect!');
            // Password incorrect
            alert('잘못된 비밀번호입니다');
            this.passwordInput.value = '';
            this.passwordInput.focus();
        }
    }
    
    startTimer() {
        console.log('Start timer clicked'); // Debug log
        this.isRunning = true;
        this.timerStarted = true;
        this.startTime = Date.now();
        
        // Clear any entered code when timer starts
        this.resetCode();
        
        this.timerInterval = setInterval(() => {
            this.updateTimer();
        }, 100);
        
        this.updateTimerStatus();
        this.updateButtonStates();
    }
    
    stopTimer() {
        console.log('Stop timer clicked'); // Debug log
        this.isRunning = false;
        this.timerStarted = false; // Reset started state when stopped
        this.timerReset = false; // Ensure reset flag is cleared
        
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
        
        this.updateTimerStatus();
        this.updateButtonStates();
    }
    
    resetTimer() {
        console.log('Reset timer clicked'); // Debug log
        // Stop the timer and reset everything
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
        this.isRunning = false;
        this.timerStarted = false;
        this.timerReset = true;
        this.elapsedTime = 0;
        this.timeLeft = this.totalTime; // Reset to 1 minute
        // Reset hint counter to 0
        this.hintUsageCount = 0;
        this.updateTimerDisplay();
        this.updateProgressRing();
        this.updateTimerStatus();
        this.updateButtonStates();
        this.updateHintCounter(); // Update the displayed counter
        // Re-enable keypad if it was disabled
        this.enableKeypad();
        // Keep reset status - don't auto-clear it
    }
    
    updateTimer() {
        if (this.isRunning) {
            const elapsed = Date.now() - this.startTime;
            this.timeLeft = Math.max(0, this.totalTime - elapsed);
            this.elapsedTime = elapsed;
            
            if (this.timeLeft <= 0) {
                // Timer finished
                this.timeLeft = 0;
                this.stopTimer();
                this.showTimeOverPopup();
                this.disableKeypad();
            }
            
            this.updateTimerDisplay();
            this.updateProgressRing();
        }
    }
    
    updateTimerDisplay() {
        if (!this.timeDisplay) return;
        
        const minutes = Math.floor(this.timeLeft / 60000);
        const seconds = Math.floor((this.timeLeft % 60000) / 1000);
        
        const timeString = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        this.timeDisplay.textContent = timeString;
        
        console.log('Timer display updated:', timeString, 'timeLeft:', this.timeLeft);
    }
    
    updateProgressRing() {
        if (!this.progressRing) return;
        
        // Calculate progress based on time left (countdown from 1 minute)
        // The white ring starts full and shrinks as time runs out
        const progress = Math.max(0, this.timeLeft / this.totalTime);
        const circumference = 283; // Full circle (2 * PI * 45)
        
        // As progress decreases, offset increases (ring shrinks)
        const offset = circumference * (1 - progress);
        
        this.progressRing.style.strokeDasharray = '283 283';
        this.progressRing.style.strokeDashoffset = offset;
    }
    
    addDigitToCode(digit) {
        if (this.currentCode.length < this.maxCodeLength) {
            this.currentCode += digit;
            this.updateCodeDisplay();
            
            // Check if code is complete
            if (this.currentCode.length === this.maxCodeLength) {
                this.handleCompleteCode();
            }
        }
    }
    
    updateCodeDisplay() {
        this.codeBoxes.forEach((box, index) => {
            box.classList.remove('filled', 'active');
            
            if (index < this.currentCode.length) {
                // Show the digit in this box
                box.textContent = this.currentCode[index];
                box.classList.add('filled');
            } else {
                // Clear any remaining boxes
                box.textContent = '';
            }
        });
    }
    
    handleCompleteCode() {
        // Check if the entered code matches any of the hint codes
        const hintNumber = this.hintCodes.get(this.currentCode);
        
        if (hintNumber) {
            // Valid code - show the corresponding hint
            const hintText = this.hints[hintNumber] || `P${hintNumber}`;
            this.showHint(hintText);
            // Increment hint usage counter
            this.hintUsageCount++;
            this.updateHintCounter();
        } else {
            // Invalid code - show brief feedback, then reset
            console.log('Invalid code entered:', this.currentCode);
            this.flashInvalidCode();
        }
    }
    
    flashInvalidCode() {
        // Flash red to indicate invalid code
        this.codeBoxes.forEach(box => {
            box.style.borderColor = '#ff6b6b';
            box.style.transition = 'border-color 0.3s ease';
        });
        
        // Reset after 1 second
        setTimeout(() => {
            this.codeBoxes.forEach(box => {
                box.style.borderColor = '';
                box.style.transition = '';
            });
            this.resetCode();
        }, 1000);
    }
    
    showHint(hintText) {
        this.popupHint.textContent = hintText;
        this.popupOverlay.classList.add('show');
    }
    
    hideHint() {
        this.popupOverlay.classList.remove('show');
        // Reset code when popup is dismissed
        this.resetCode();
    }
    
    resetCode() {
        this.currentCode = '';
        this.codeBoxes.forEach(box => {
            box.classList.remove('filled', 'active');
            box.textContent = '';
        });
    }
    
    updateHintCounter() {
        if (this.hintCounter) {
            this.hintCounter.textContent = `${this.hintUsageCount}/999`;
        }
    }
    
    showTimeOverPopup() {
        // Show time over message
        if (this.popupHint) {
            this.popupHint.textContent = '시간 종료!';
            this.popupOverlay.classList.add('show');
        }
    }
    
    disableKeypad() {
        // Disable all keypad buttons
        if (this.keypadButtons) {
            this.keypadButtons.forEach(button => {
                button.disabled = true;
            });
        }
    }
    
    enableKeypad() {
        // Re-enable all keypad buttons
        if (this.keypadButtons) {
            this.keypadButtons.forEach(button => {
                button.disabled = false;
            });
        }
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new EscapeRoomTimer();
});

// Add some additional interactive features
document.addEventListener('DOMContentLoaded', () => {
    // Add haptic feedback simulation for mobile
    const keys = document.querySelectorAll('.key');
    keys.forEach(key => {
        key.addEventListener('touchstart', (e) => {
            // Simulate haptic feedback
            if (navigator.vibrate) {
                navigator.vibrate(10);
            }
        });
    });
});
