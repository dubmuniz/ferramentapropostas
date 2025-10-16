import Readability from "https://esm.sh/@mozilla/readability@0.5.0";
import { JSDOM } from "https://esm.sh/jsdom@24.0.0";
import * as pdfjsLib from "https://esm.sh/pdfjs-dist@4.4.168";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === "/extract") {
      const target = url.searchParams.get("url");
      if (!target) return json({ error: "missing url" }, 400);

      const head = await fetch(target, { method: "HEAD" }).catch(()=>null);
      const ctype = head?.headers.get("content-type") || "";

      // HTML
      if (ctype.includes("text/html")) {
        const html = await (await fetch(target)).text();
        const dom = new JSDOM(html, { url: target });
        const reader = new Readability(dom.window.document);
        const article = reader.parse();
        const text = (article?.textContent || dom.window.document.body.textContent || "").trim();
        return json({ type: "html", text, title: article?.title || dom.window.document.title || "" });
      }

      // PDF
      if (ctype.includes("pdf") || target.toLowerCase().endsWith(".pdf")) {
        const ab = await (await fetch(target)).arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: ab }).promise;
        let text = "";
        for (let p = 1; p <= pdf.numPages; p++) {
          const page = await pdf.getPage(p);
          const content = await page.getTextContent();
          text += content.items.map(it => it.str).join(" ") + "\n";
        }
        return json({ type: "pdf", text: text.trim(), title: "" });
      }

      // Fallback: pega texto cru
      const resp = await fetch(target);
      const body = await resp.text();
      return json({ type: "raw", text: body, title: "" });
    }
    return new Response("OK");
  }
};

function json(obj, status=200){
  return new Response(JSON.stringify(obj), { status, headers:{ "content-type":"application/json; charset=utf-8", "access-control-allow-origin":"*" }});
}
