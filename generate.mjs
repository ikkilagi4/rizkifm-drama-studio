const MODEL = "gemini-2.5-flash";

export default async (request) => {
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Gunakan metode POST." }), { status: 405, headers: { "content-type": "application/json" } });
  }
  const origin = request.headers.get("origin");
  const siteUrl = process.env.URL;
  if (origin && siteUrl && new URL(origin).host !== new URL(siteUrl).host) {
    return new Response(JSON.stringify({ error: "Asal permintaan tidak diizinkan." }), { status: 403, headers: { "content-type": "application/json" } });
  }
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "API key belum dipasang di Netlify. Tambahkan environment variable GEMINI_API_KEY." }), { status: 503, headers: { "content-type": "application/json" } });
  }
  let body;
  try { body = await request.json(); } catch {
    return new Response(JSON.stringify({ error: "Data permintaan tidak valid." }), { status: 400, headers: { "content-type": "application/json" } });
  }
  const task = String(body.task || "");
  const input = String(body.input || "").slice(0, 18000);
  const allowed = ["story", "dialog", "prompt", "complete"];
  if (!allowed.includes(task) || !input.trim()) {
    return new Response(JSON.stringify({ error: "Jenis tugas atau isi permintaan belum lengkap." }), { status: 400, headers: { "content-type": "application/json" } });
  }
  const instructions = {
    story: "Buat kerangka drama lengkap dan terstruktur dalam bahasa Indonesia. Sertakan logline, sinopsis, daftar karakter, konflik utama, alur episode sesuai jumlah yang diminta, klimaks, dan penyelesaian. Jaga kesinambungan dan jangan membuat lompatan alur yang tidak dijelaskan.",
    dialog: "Tulis adegan dialog yang natural, hidup, dan realistis dalam bahasa Indonesia. Beri label nama pembicara dengan jelas. Pastikan respons saling menanggapi, karakter tidak tertukar, dan tambahkan arahan ekspresi/aksi singkat bila membantu.",
    prompt: "Ubah bahan menjadi prompt video Seedance yang lengkap dan siap salin. Pertahankan urutan aksi persis sesuai input. Tulis dalam bahasa Indonesia yang jelas, dengan arahan kamera, gerakan, ekspresi, kontinuitas, sinkronisasi bibir untuk pembicara saja, dan larangan karakter tambahan yang tidak diminta. Utamakan ultra-photorealistic live-action, bukan kartun/anime/game. Jangan mengubah detail yang diberikan.",
    complete: "Buat paket pra-produksi drama lengkap dalam bahasa Indonesia: judul, logline, sinopsis, profil karakter, alur semua episode sesuai jumlah yang diminta, dialog pembuka episode 1, dan prompt Seedance untuk adegan pembuka episode 1. Jaga konsistensi karakter dan kesinambungan antar episode. Format dengan judul dan subjudul yang mudah dibaca."
  };
  const prompt = `${instructions[task]}\n\nKONTEKS PENGGUNA:\n${input}`;
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }], generationConfig: { temperature: 0.85, maxOutputTokens: 7000 } })
    });
    const data = await response.json();
    if (!response.ok) {
      const message = data?.error?.message || `Gemini mengembalikan status ${response.status}.`;
      return new Response(JSON.stringify({ error: message }), { status: response.status, headers: { "content-type": "application/json" } });
    }
    const text = data?.candidates?.[0]?.content?.parts?.map(p => p.text || "").join("\n").trim();
    if (!text) throw new Error("AI tidak mengembalikan teks. Coba lagi.");
    return new Response(JSON.stringify({ text, model: MODEL }), { status: 200, headers: { "content-type": "application/json", "cache-control": "no-store" } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message || "Gagal menghubungi Gemini." }), { status: 500, headers: { "content-type": "application/json" } });
  }
};
