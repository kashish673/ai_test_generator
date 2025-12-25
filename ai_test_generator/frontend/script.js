// Authentication Functions
async function signin() {
    let email = document.getElementById("signinEmail").value.trim();
    let password = document.getElementById("signinPassword").value.trim();

    console.log("Sending request to backend...");

    try {
        const res = await fetch("http://localhost:5000/api/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password })
        });

        console.log("Response status:", res.status);

        const data = await res.json();
        console.log("Response data:", data);

        if (res.ok && data.token) {
            localStorage.setItem("token", data.token);
            localStorage.setItem("loggedInUser", JSON.stringify(data.user));
            
            // ENABLE Generate Test Button Immediately
            const btn = document.getElementById("generateBtn");
            if (btn) btn.disabled = false;
            
            // Unlock generator section
            const generator = document.getElementById("generator");
            if (generator) {
                generator.style.pointerEvents = "auto";
                generator.style.opacity = "1";
            }
            
            alert("Login successful!");
            closeAuthModal();
            updateNavForAuth();
        } else {
            // Check if email is not verified (403 status)
            if (res.status === 403 && data.emailVerified === false) {
                const resend = confirm(data.message + "\n\nWould you like to resend the verification email?");
                if (resend) {
                    await resendVerificationEmail(email);
                }
            } else {
                alert(data.error || "Login failed");
            }
        }

    } catch (err) {
        console.error("FULL ERROR:", err);
        alert("Server error. Backend not reachable.");
    }
}

async function signup() {
    let name = document.getElementById("signupName").value.trim();
    let email = document.getElementById("signupEmail").value.trim();
    let password = document.getElementById("signupPassword").value.trim();

    if (!name || !email || !password) {
        alert("Please fill all fields.");
        return;
    }
    try {
        const res = await fetch("http://localhost:5000/api/auth/register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, email, password, role: "student" })
        });

        const data = await res.json();

        if (res.ok) {
            // Show appropriate message based on email configuration
            let message = data.message || "Signup successful! Please check your email to verify your account before logging in.";
            
            // If verification link is provided (email not configured), show it
            if (data.verificationLink) {
                message += "\n\nVerification Link:\n" + data.verificationLink;
                message += "\n\n(Email service not configured. Please use this link to verify your account.)";
            }
            
            alert(message);
            switchAuthModal('signin');
        } else {
            alert(data.error || "Signup failed");
        }

    } catch (err) {
        alert("Server error. Backend not reachable.");
    }
}

// Auth Modal Functions
function openAuthModal(type = 'signin') {
    const modal = document.getElementById('authModal');
    switchAuthModal(type);
    modal.classList.add('active');
}

function closeAuthModal() {
    const modal = document.getElementById('authModal');
    modal.classList.remove('active');
}

function switchAuthModal(type) {
    const signinForm = document.getElementById('signinForm');
    const signupForm = document.getElementById('signupForm');
    
    if (type === 'signin') {
        signinForm.style.display = 'block';
        signupForm.style.display = 'none';
    } else {
        signinForm.style.display = 'none';
        signupForm.style.display = 'block';
    }
}

function updateNavForAuth() {
    const token = localStorage.getItem("token");
    const navLinks = document.querySelector('.nav-links');
    
    if (token) {
        const user = JSON.parse(localStorage.getItem("loggedInUser") || '{}');
        navLinks.innerHTML = `
            <li><a href="#generator">Generator</a></li>
            <li><a href="#about">About</a></li>
            <li><span style="color: var(--text-secondary);">Welcome, ${user.name || 'User'}</span></li>
            <li><a href="#" onclick="logout()" class="btn btn-secondary btn-sm">Logout</a></li>
        `;
    } else {
        navLinks.innerHTML = `
            <li><a href="#generator">Generator</a></li>
            <li><a href="#about">About</a></li>
            <li><a href="#" onclick="openAuthModal('signup')" class="btn btn-secondary btn-sm">Sign Up</a></li>
            <li><a href="#" onclick="openAuthModal('signin')" class="btn btn-primary btn-sm">Sign In</a></li>
        `;
    }
}

function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("loggedInUser");
    updateNavForAuth();
    const btn = document.getElementById("generateBtn");
    if (btn) btn.disabled = true;
    alert("Logged out successfully!");
}

// Email verification functions
async function resendVerificationEmail(email) {
    try {
        const res = await fetch("http://localhost:5000/api/auth/resend-verification", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email })
        });

        const data = await res.json();

        if (res.ok) {
            let message = data.message || "Verification email sent! Please check your inbox.";
            
            // If verification link is provided (email not configured), show it
            if (data.verificationLink) {
                message += "\n\nVerification Link:\n" + data.verificationLink;
                message += "\n\n(Email service not configured. Please use this link to verify your account.)";
            }
            
            alert(message);
        } else {
            alert(data.error || "Failed to resend verification email");
        }
    } catch (err) {
        alert("Server error. Backend not reachable.");
    }
}

// Check for email verification token in URL
function checkEmailVerification() {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    
    if (token) {
        verifyEmail(token);
    }
}

async function verifyEmail(token) {
    try {
        const res = await fetch(`http://localhost:5000/api/auth/verify-email?token=${token}`, {
            method: "GET",
            headers: { "Content-Type": "application/json" }
        });

        const data = await res.json();

        if (res.ok) {
            alert("Email verified successfully! You can now log in.");
            // Remove token from URL
            window.history.replaceState({}, document.title, window.location.pathname);
            // Open sign in modal
            openAuthModal('signin');
        } else {
            alert(data.error || "Email verification failed");
        }
    } catch (err) {
        alert("Server error. Backend not reachable.");
    }
}

// Test Generation Functions
async function generateTest() {
    const token = localStorage.getItem("token");

    if (!token) {
        alert("❗ You must log in first. Backend requires authentication.");
        openAuthModal('signin');
        return;
    }

    const numQuestionsValue = parseInt(document.getElementById('numQuestions').value);
    const topicsValue = document.getElementById('topics').value;

    if (numQuestionsValue < 1 || topicsValue.trim() === "") {
        alert("Please provide a topic and a valid number of questions (minimum 1).");
        return;
    }

    // Collect selected question types
    const questionTypes = [];
    if (document.getElementById('mcq').checked) questionTypes.push('MCQ');
    if (document.getElementById('shortAnswer').checked) questionTypes.push('Short Answer');
    if (document.getElementById('truefalse').checked) questionTypes.push('True/False');
    if (document.getElementById('essay').checked) questionTypes.push('Long Answer');
    if (document.getElementById('fillup').checked) questionTypes.push('FillBlank');

    if (questionTypes.length === 0) {
        alert("Please select at least one question type.");
        return;
    }
    
    document.getElementById('generateBtn').textContent = 'Generating...';
    document.getElementById('generateBtn').disabled = true;

    const testData = {
        title: document.getElementById('testTitle').value,
        notes: "Auto-generated test via frontend",
        count: parseInt(document.getElementById('numQuestions').value), 
        difficulty: document.getElementById('difficulty').value,
        topic: document.getElementById('topics').value,
        description: "Generated using AI Test Generator",
        timeLimitMin: 0,
        questionTypes: questionTypes
    };

    try {
        const response = await fetch("http://localhost:5000/api/tests/generate", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": "Bearer " + token
            },
            body: JSON.stringify(testData)
        });

        const result = await response.json();
        console.log("Backend Response:", result);

        if (!response.ok) {
            alert(result.error || "Test generation failed.");
            return;
        }

        document.getElementById('form-tab').classList.remove('active');
        document.getElementById('preview-tab').classList.add('active');
        document.querySelectorAll('.tab-btn')[0].classList.remove('active');
        document.querySelectorAll('.tab-btn')[1].classList.add('active');
    
        document.getElementById('successMsg').style.display = 'block';

        renderTestPreview(
            testData.title,
            "N/A",
            testData.difficulty,
            testData.count,
            testData.topic,
            result.questions
        );

    } catch (error) {
        console.error("Error connecting to backend:", error);
        alert("Could not reach backend.");
    } finally {
        document.getElementById('generateBtn').textContent = 'Generate Test';
        document.getElementById('generateBtn').disabled = false;
    }
}

function renderTestPreview(testTitle, subject, difficulty, numQuestions, topicsText, questionsArray) {
    const preview = document.getElementById('testPreview');
    const empty = document.getElementById('emptyPreview');
    const container = document.getElementById('questionsContainer');

    // Update metadata
    document.getElementById('previewTestTitle').textContent = testTitle;
    document.getElementById('previewTopics').textContent = topicsText;
    document.getElementById('previewDifficulty').textContent = difficulty.toUpperCase();
    document.getElementById('previewCount').textContent = questionsArray.length + ' Questions';

    // Generate questions
    container.innerHTML = '';
    for (let i = 0; i < questionsArray.length; i++) {
        const q = questionsArray[i];
        const questionEl = document.createElement('div');
        questionEl.className = 'test-question';
        
        questionEl.innerHTML = `
            <div class="test-question-title">Q${i + 1}. ${q.question}</div>
            ${renderQuestionOptions(q)}
        `;
        container.appendChild(questionEl);
    }

    preview.classList.remove('hidden');
    empty.classList.add('hidden');
}

function renderQuestionOptions(q) {
    if (q.type === 'MCQ') {
        return `
            <div class="test-options">
                ${q.options.map((opt, idx) => `
                    <label class="test-option">
                        <input type="radio" name="q${idx}" value="${opt}">
                        <span>${String.fromCharCode(65 + idx)}. ${opt}</span>
                    </label>
                `).join('')}
            </div>
        `;
    } else if (q.type === 'True/False') {
        return `
            <div class="test-options">
                <label class="test-option">
                    <input type="radio" name="q" value="true">
                    <span>A. True</span>
                </label>
                <label class="test-option">
                    <input type="radio" name="q" value="false">
                    <span>B. False</span>
                </label>
            </div>
        `;
    } else if (q.type === 'Short Answer') {
        return `<div style="margin-top: var(--spacing-md); padding: var(--spacing-md); border: 1px dashed var(--border); border-radius: 6px; min-height: 80px; background: white; font-style: italic; color: var(--text-secondary);">Answer: <span style="border-bottom: 2px solid var(--text-secondary); min-width: 200px; display: inline-block;"></span></div>`;
    } else if (q.type === 'Long Answer' || q.type === 'Essay') {
        return `<div style="margin-top: var(--spacing-md); padding: var(--spacing-md); border: 1px dashed var(--border); border-radius: 6px; min-height: 200px; background: white; font-style: italic; color: var(--text-secondary);">Answer: <div style="margin-top: var(--spacing-sm); border: 1px solid var(--border); border-radius: 4px; min-height: 180px; padding: var(--spacing-sm);"></div></div>`;
    } else if (q.type === 'Fill in the Blank' || q.type === 'FillBlank') {
        return `<div style="margin-top: var(--spacing-md); padding: var(--spacing-md); border: 1px dashed var(--border); border-radius: 6px; min-height: 60px; background: white; font-style: italic; color: var(--text-secondary);">Fill in the blank(s) above</div>`;
    } else {
        return `<div style="margin-top: var(--spacing-md); padding: var(--spacing-md); border: 1px dashed var(--border); border-radius: 6px; min-height: 80px; background: white; font-style: italic; color: var(--text-secondary);">Answer: <span style="border-bottom: 2px solid var(--text-secondary); min-width: 200px; display: inline-block;"></span></div>`;
    }
}

function resetForm() {
    document.getElementById('testForm').reset();
    document.getElementById('testPreview').classList.add('hidden');
    document.getElementById('emptyPreview').classList.remove('hidden');
}

function downloadTest() {
    alert('Download feature will be available soon. This would generate a PDF version of the test.');
}

function shareTest() {
    alert('Share feature will be available soon. You can share this test via link or email.');
}

function printTest() {
    window.print();
}

function switchTab(event, tabName) {
    // Hide all tabs
    const tabs = document.querySelectorAll('.tab-content');
    tabs.forEach(tab => tab.classList.remove('active'));

    // Remove active from all buttons
    const buttons = document.querySelectorAll('.tab-btn');
    buttons.forEach(btn => btn.classList.remove('active'));

    // Show selected tab
    document.getElementById(tabName).classList.add('active');
    event.target.classList.add('active');
}

function scrollToGenerator() {
    document.getElementById('generator').scrollIntoView({ behavior: 'smooth' });
}

// Initialize on page load
window.onload = function () {
    const btn = document.getElementById("generateBtn");
    const token = localStorage.getItem("token");

    if (token) {
        if (btn) btn.disabled = false;
        // Unlock generator section
        const generator = document.getElementById("generator");
        if (generator) {
            generator.style.pointerEvents = "auto";
            generator.style.opacity = "1";
        }
    } else {
        if (btn) btn.disabled = true;
    }
    
    updateNavForAuth();
    checkEmailVerification(); // Check for email verification token
};

// Lock generator until user logs in
document.addEventListener("DOMContentLoaded", function () {
    const token = localStorage.getItem("token");

    if (!token) {
        const generator = document.getElementById("generator");
        if (generator) {
            generator.style.pointerEvents = "none";
            generator.style.opacity = "0.4";
        }
    } else {
        const generator = document.getElementById("generator");
        if (generator) {
            generator.style.pointerEvents = "auto";
            generator.style.opacity = "1";
        }
    }
    
    updateNavForAuth();
});

// Keyboard navigation
document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.ctrlKey) {
        generateTest();
    }
    
    // Close modal on Escape
    if (e.key === 'Escape') {
        closeAuthModal();
    }
});

// Close modal when clicking outside
document.addEventListener('click', (e) => {
    const modal = document.getElementById('authModal');
    if (e.target === modal) {
        closeAuthModal();
    }
});

