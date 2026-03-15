
async function testGemini() {
    const API_KEY = "AIzaSyBjFgPKU8s9r6jU2LVwNXm8syuSouQbuCY";
    const modelsUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`;

    try {
        const response = await fetch(modelsUrl);
        const data = await response.json();
        console.log("Available models:");
        data.models.forEach(m => console.log(m.name));
    } catch (e) {
        console.error("Error fetching models:", e);
    }
}

testGemini();
