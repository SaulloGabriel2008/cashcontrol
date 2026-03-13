
async function testGemini() {
    const API_KEY = process.env.GEMINI_API_KEY;
    if (!API_KEY) {
        throw new Error("GEMINI_API_KEY nao configurada");
    }
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
