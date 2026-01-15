const fetch = require('node-fetch');

async function searchCasts(username) {
    // Exact text matching logic
    const query = "Baseposted with Word Rain";
    const url = `https://searchcaster.xyz/api/search?text=${encodeURIComponent(query)}&username=${username}`;
    console.log("Querying:", url);

    try {
        const res = await fetch(url);
        const data = await res.json();
        console.log("Full Response:", JSON.stringify(data, null, 2));

        if (data.casts) {
            console.log(`Found ${data.casts.length} casts.`);
            data.casts.forEach(cast => {
                console.log(`- [${new Date(cast.body.publishedAt).toISOString()}] ${cast.body.data.text.substring(0, 50)}...`);
            });
        } else {
            console.log("No 'casts' field in response.");
        }
    } catch (e) {
        console.error("Error:", e);
    }
}

searchCasts("utkus"); // Test with owner username
