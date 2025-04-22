// 🛡️ Your original FIREBASE CONFIG
const firebaseConfig = {
    apiKey: "AIzaSyChtL2mruDvQ2MwptfNKEf4lbQQzVGlx4E",
    authDomain: "athena-6ac3b.firebaseapp.com",
    projectId: "athena-6ac3b",
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// 🛡️ Your original ELEMENTS
const loginScreen = document.getElementById("login-screen");
const appScreen = document.getElementById("app-screen");
const loginBtn = document.getElementById("login-btn");
const logoutBtn = document.getElementById("logout-btn");
const chatBox = document.getElementById("chat");
const chatForm = document.getElementById("chat-form");
const userInput = document.getElementById("user-input");

let user = null;
let conversationHistory = [];

// 🛡️ Your original LOGIN HANDLERS
loginBtn.addEventListener("click", () => {
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider).catch(err => {
        alert("Login failed: " + err.message);
    });
});

logoutBtn.addEventListener("click", () => {
    auth.signOut();
});

auth.onAuthStateChanged(async (currentUser) => {
    if (currentUser) {
        user = currentUser;
        loginScreen.classList.add("hidden");
        appScreen.classList.remove("hidden");

        loginBtn.classList.add("hidden");
        logoutBtn.classList.remove("hidden");

        conversationHistory = [];
        chatBox.innerHTML = "";

        const messagesSnapshot = await db.collection("users")
            .doc(user.uid)
            .collection("messages")
            .orderBy("timestamp")
            .get();

        messagesSnapshot.forEach(doc => {
            const data = doc.data();
            const msg = document.createElement("p");
            msg.innerHTML = `<strong>${data.role === "user" ? "You" : "Athena"}:</strong> ${data.text}`;
            chatBox.appendChild(msg);
            conversationHistory.push({ role: data.role, text: data.text });
        });

        chatBox.scrollTop = chatBox.scrollHeight;
    } else {
        user = null;
        loginScreen.classList.remove("hidden");
        appScreen.classList.add("hidden");

        loginBtn.classList.remove("hidden");
        logoutBtn.classList.add("hidden");
    }
});

// 🛡️ Your original CHAT HANDLER, upgraded with RAG
chatForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const message = userInput.value.trim();
    if (!message) return;

    const userMsg = document.createElement("p");
    userMsg.innerHTML = `<strong>You:</strong> ${message}`;
    chatBox.appendChild(userMsg);
    userInput.value = "";
    chatBox.scrollTop = chatBox.scrollHeight;

    if (user) {
        await db.collection("users")
            .doc(user.uid)
            .collection("messages")
            .add({
                role: "user",
                text: message,
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            });
    }

    conversationHistory.push({ role: "user", text: message });

    const botMsg = document.createElement("p");
    botMsg.innerHTML = `<strong>Athena:</strong> ⏳ Thinking...`;
    chatBox.appendChild(botMsg);
    chatBox.scrollTop = chatBox.scrollHeight;

    let sentiment = "neutral";
    try {
        const sentimentResponse = await fetch("https://api-inference.huggingface.co/models/nateraw/bert-base-uncased-emotion", {
            method: "POST",
            headers: {
                "Authorization": "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",
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ inputs: message }),
        });
        const sentimentData = await sentimentResponse.json();
        if (Array.isArray(sentimentData) && sentimentData[0]) {
            sentiment = sentimentData[0][0].label || "neutral";
        }
    } catch (err) {
        console.error("Sentiment error:", err);
    }

    const titles = ["My warrior", "My champion", "Young one", "Little one"];
    const title = titles[Math.floor(Math.random() * titles.length)];

    try {
        const chatContext = conversationHistory.map(entry => {
            return `${entry.role === "user" ? "You" : "Athena"}: ${entry.text}`;
        }).join("\n");

        // 🛡️ NEW: Fetch relevant context using embeddings (RAG Part)
        let retrievedContext = await retrieveRelevantContext(message);

        const finalPrompt = `${retrievedContext}\n${chatContext}\n${title}, I sense your mood is ${sentiment}. Please give a thoughtful, helpful reply, avoiding unnecessary length. Use short bullet points if needed, spaced by line breaks.`;

        const cohereResponse = await fetch("https://api.cohere.ai/v1/chat", {
            method: "POST",
            headers: {
                "Authorization": "Bearer qBfxYLFMF62fMjCjh2VZSXylVnZ4UBy4vKL0IWfh",
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "command-r",
                message: finalPrompt
            })
        });

        const cohereData = await cohereResponse.json();
        if (cohereResponse.ok && cohereData.text) {
            let replyText = cohereData.text.trim();
            if (replyText.includes("\n")) {
                replyText = replyText.split("\n").map(line => line.trim()).filter(line => line).join("<br><br>");
            }

            const botReply = `💬 ${title}, ${replyText} I stand by you always.`;
            botMsg.innerHTML = `<strong>Athena:</strong> ${botReply}`;

            if (user) {
                await db.collection("users")
                    .doc(user.uid)
                    .collection("messages")
                    .add({
                        role: "bot",
                        text: replyText.replace(/<br><br>/g, "\n"),
                        sentiment,
                        timestamp: firebase.firestore.FieldValue.serverTimestamp()
                    });
            }

            conversationHistory.push({ role: "bot", text: replyText.replace(/<br><br>/g, "\n") });

        } else {
            botMsg.innerHTML = `<strong>Athena:</strong> ⚠ I couldn't gather the words for you this time, my Champion. But rest assured, I will always stand by your side.`;
        }
    } catch (err) {
        botMsg.innerHTML = `<strong>Athena:</strong> ⚠ The divine realms have momentarily clouded, my Champion. But worry not, my love for you remains constant.`;
    }

    chatBox.scrollTop = chatBox.scrollHeight;
});

// 🛡️ Your original FILE UPLOAD HANDLER (upgraded to create embeddings)
const fileInput = document.createElement("input");
fileInput.type = "file";
fileInput.accept = "application/pdf,image/*";
fileInput.style.display = "none";

const uploadBtn = document.createElement("button");
uploadBtn.textContent = "📂 Upload File";
uploadBtn.type = "button";
uploadBtn.className = "upload-btn";

appScreen.appendChild(uploadBtn);
appScreen.appendChild(fileInput);

const loadScript = (src) => {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
    });
};

(async () => {
    await loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.13.216/pdf.min.js');
    await loadScript('https://cdn.jsdelivr.net/npm/tesseract.js@2.1.5/dist/tesseract.min.js');
})();

uploadBtn.addEventListener("click", () => {
    fileInput.click();
});

fileInput.addEventListener("change", async () => {
    const file = fileInput.files[0];
    if (!file) return;

    const fileType = file.type;

    const loadingMsg = document.createElement("p");
    loadingMsg.innerHTML = `<strong>Athena:</strong> 📖 Reading your file...`;
    chatBox.appendChild(loadingMsg);
    chatBox.scrollTop = chatBox.scrollHeight;

    try {
        let extractedText = "";

        if (fileType === "application/pdf") {
            const reader = new FileReader();
            reader.onload = async function () {
                const typedArray = new Uint8Array(this.result);
                const pdf = await pdfjsLib.getDocument({ data: typedArray }).promise;
                for (let i = 1; i <= pdf.numPages; i++) {
                    const page = await pdf.getPage(i);
                    const content = await page.getTextContent();
                    const pageText = content.items.map(item => item.str).join(' ');
                    extractedText += pageText + "\n";
                }
                await handleExtractedText(extractedText);
                loadingMsg.remove();
            };
            reader.readAsArrayBuffer(file);
        } else if (fileType.startsWith("image/")) {
            const imageUrl = URL.createObjectURL(file);
            const result = await Tesseract.recognize(imageUrl, 'eng');
            extractedText = result.data.text;
            await handleExtractedText(extractedText);
            loadingMsg.remove();
        } else {
            alert("Unsupported file type. Please upload a PDF or Image.");
            loadingMsg.remove();
        }
    } catch (error) {
        console.error("File reading error:", error);
        loadingMsg.innerHTML = `<strong>Athena:</strong> ⚠ Failed to read your file, my brave one.`;
    }
});

async function handleExtractedText(text) {
    if (!text.trim()) {
        alert("No readable text found in file.");
        return;
    }

    const userMsg = document.createElement("p");
    userMsg.innerHTML = `<strong>You (uploaded):</strong> ${text}`;
    chatBox.appendChild(userMsg);

    conversationHistory.push({ role: "user", text });

    if (user) {
        await db.collection("users")
            .doc(user.uid)
            .collection("messages")
            .add({
                role: "user",
                text,
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            });

        const chunks = splitTextIntoChunks(text);
        for (const chunk of chunks) {
            const embedding = await getEmbedding(chunk);
            await db.collection("users")
                .doc(user.uid)
                .collection("chunks")
                .add({
                    text: chunk,
                    embedding,
                    timestamp: firebase.firestore.FieldValue.serverTimestamp()
                });
        }
    }

    chatBox.scrollTop = chatBox.scrollHeight;
}

// 🛡️ New helper functions for RAG
function splitTextIntoChunks(text, chunkSize = 300) {
    const words = text.split(' ');
    const chunks = [];
    for (let i = 0; i < words.length; i += chunkSize) {
        chunks.push(words.slice(i, i + chunkSize).join(' '));
    }
    return chunks;
}

async function getEmbedding(text) {
    const response = await fetch('https://api.cohere.ai/v1/embed', {
        method: "POST",
        headers: {
            "Authorization": "Bearer qBfxYLFMF62fMjCjh2VZSXylVnZ4UBy4vKL0IWfh",
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ texts: [text], model: "embed-english-v2.0" })
    });
    const data = await response.json();
    return data.embeddings[0];
}

function cosineSimilarity(vecA, vecB) {
    const dotProduct = vecA.reduce((acc, val, i) => acc + val * vecB[i], 0);
    const magnitudeA = Math.sqrt(vecA.reduce((acc, val) => acc + val * val, 0));
    const magnitudeB = Math.sqrt(vecB.reduce((acc, val) => acc + val * val, 0));
    return dotProduct / (magnitudeA * magnitudeB);
}

async function retrieveRelevantContext(question) {
    const chunksSnapshot = await db.collection("users")
        .doc(user.uid)
        .collection("chunks")
        .get();

    const allChunks = [];
    chunksSnapshot.forEach(doc => {
        allChunks.push(doc.data());
    });

    if (allChunks.length === 0) return "";

    const questionEmbedding = await getEmbedding(question);

    allChunks.forEach(chunk => {
        chunk.similarity = cosineSimilarity(questionEmbedding, chunk.embedding);
    });

    allChunks.sort((a, b) => b.similarity - a.similarity);

    const topChunks = allChunks.slice(0, 3);

    return topChunks.map(c => `📚 ${c.text}`).join("\n\n");
}
// ➡️ Instant Scroll to Bottom Button
const instantScrollBtn = document.createElement("button");
instantScrollBtn.textContent = "⬇️ Jump to Bottom";
instantScrollBtn.style.position = "fixed";
instantScrollBtn.style.bottom = "80px";
instantScrollBtn.style.right = "20px";
instantScrollBtn.style.padding = "10px 15px";
instantScrollBtn.style.fontSize = "14px";
instantScrollBtn.style.borderRadius = "10px";
instantScrollBtn.style.backgroundColor = "#1F2937";
instantScrollBtn.style.color = "#fff";
instantScrollBtn.style.border = "none";
instantScrollBtn.style.cursor = "pointer";
instantScrollBtn.style.boxShadow = "0 2px 6px rgba(0, 0, 0, 0.3)";
instantScrollBtn.style.zIndex = "999";

// Add the button to the body
document.body.appendChild(instantScrollBtn);

// Event Listener for the button click
instantScrollBtn.addEventListener("click", () => {
    window.scrollTo(0, document.body.scrollHeight);
});

// Show or hide the button based on scroll position
window.addEventListener("scroll", () => {
    const nearBottom = (window.innerHeight + window.scrollY) >= (document.body.scrollHeight - 50);
    
    // Toggle visibility based on scroll position
    if (nearBottom) {
        instantScrollBtn.style.display = "none";  // Hide button when near bottom
    } else {
        instantScrollBtn.style.display = "block"; // Show button when not at bottom
    }
});

// Ensure the button is initially visible even if page is scrolled
window.addEventListener("load", () => {
    instantScrollBtn.style.display = "block"; // Display the button after page load
});

