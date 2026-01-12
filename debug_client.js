async function main() {
    const addr = "0x6edd22E9792132614dD487aC6434dec3709b79A8";
    try {
        // Trying client endpoint which is often open for frontend
        const res = await fetch(`https://client.warpcast.com/v2/user-by-verification?address=${addr}`);
        console.log("Status:", res.status);
        if (res.status === 200) {
            const data = await res.json();
            console.log("User:", data?.result?.user?.username);
        }
    } catch (e) { console.log(e.message); }
}
main();
