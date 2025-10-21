import { createMergeableStore } from "tinybase";
import { createDurableObjectStoragePersister } from "tinybase/persisters/persister-durable-object-storage";
import {
  WsServerDurableObject,
} from "tinybase/synchronizers/synchronizer-ws-server-durable-object";

//Durable Object untuk menyimpan data TinyBase
export class GroceriesDurableObject extends WsServerDurableObject {
  private store: any;       
  private persister: any;
  constructor(ctx: DurableObjectState, env: any) {
    super(ctx, env);
    this.store = createMergeableStore();
    this.persister = createDurableObjectStoragePersister(
      this.store,
      this.ctx.storage
    );
  }
  createPersister() {
    return this.persister;
  }

  //endpoint /debug untuk lihat isi database
  // async fetch(request: Request): Promise<Response> {
  //   const url = new URL(request.url);

  //   if (url.pathname === "/debug") {
  //     await this.persister.load();
  //     const tables = this.store.getTables();
  //     return new Response(JSON.stringify(tables, null, 2), {
  //       headers: { "content-type": "application/json; charset=utf-8" },
  //     });
  //   }
  //   const parentFetch = Object.getPrototypeOf(
  //     WsServerDurableObject.prototype
  //   ).fetch.bind(this);
  //   return parentFetch(request);
  // }

  // Helper: normalisasi berbagai tipe rows -> [ [id, value], ... ]
  private normalizeRows(rows: any): [string, any][] {
    if (rows == null) return [];
    if (rows instanceof Map) {
      return Array.from(rows.entries()).map(([k, v]) => [String(k), v]);
    }
    if (Array.isArray(rows)) {
      return rows.map((v, i) => [String(i), v]);
    }
    if (typeof rows === "object") {
      return Object.entries(rows).map(([k, v]) => [String(k), v]);
    }
    // primitive
    return [["0", rows]];
  }

  // Endpoint /debug yang aman terhadap berbagai bentuk data
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/debug") {
      // pastikan load dulu persister supaya data terkini
      await this.persister.load();
      const tables = this.store.getTables();

      let html = `
        <html>
          <head>
            <title>Debug Database - TinyBase</title>
            <style>
              body { font-family: system-ui, sans-serif; background: #fafafa; color: #333; padding: 20px; }
              h1 { color: #2c3e50; }
              table { border-collapse: collapse; width: 100%; margin-bottom: 30px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
              th, td { border: 1px solid #ccc; padding: 8px; text-align: left; vertical-align: top; }
              th { background: #f0f0f0; }
              pre { margin: 0; white-space: pre-wrap; word-wrap: break-word; font-size: 0.95em; }
              footer { margin-top: 20px; font-size: 0.9em; color: #666; }
            </style>
          </head>
          <body>
            <h1>📦 TinyBase Database Debug View</h1>
      `;

      const tableNames = Object.keys(tables || {});
      if (tableNames.length === 0) {
        html += `<p><em>Tidak ada tabel dalam database saat ini.</em></p>`;
      } else {
        for (const tableName of tableNames) {
          const rows = (tables as any)[tableName];
          const entries = this.normalizeRows(rows);

          html += `<h2>🗂️ Tabel: ${tableName} (baris: ${entries.length})</h2>`;
          html += `<table><tr><th style="width:160px">ID</th><th>Data</th></tr>`;

          if (entries.length === 0) {
            html += `<tr><td colspan="2"><em>-- kosong --</em></td></tr>`;
          } else {
            for (const [id, value] of entries) {
              // jika value adalah object plain (bukan array), stringify dengan pretty print
              let cell = "";
              if (value && typeof value === "object" && !Array.isArray(value)) {
                cell = `<pre>${JSON.stringify(value, null, 2)}</pre>`;
              } else {
                // untuk array / primitive / dll, bungkus dalam value
                cell = `<pre>${JSON.stringify(value, null, 2)}</pre>`;
              }
              html += `<tr><td>${id}</td><td>${cell}</td></tr>`;
            }
          }

          html += `</table>`;
        }
      }

      html += `<footer>Terakhir diperbarui: ${new Date().toLocaleString()}</footer></body></html>`;

      return new Response(html, {
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }

    // Bukan /debug -> teruskan ke handler bawaan (WebSocket dll.)
    const parentFetch = Object.getPrototypeOf(
      WsServerDurableObject.prototype
    ).fetch.bind(this);
    return parentFetch(request);
  }

}

//Entry point utama Worker
export default {
  async fetch(request: Request, env: any, ctx: ExecutionContext) {
    const url = new URL(request.url);
    const upgradeHeader = request.headers.get("Upgrade");
    const id = env.GroceriesDurableObjects.idFromName("main");
    const obj = env.GroceriesDurableObjects.get(id);

    //Route khusus untuk /debug
    if (url.pathname === "/debug") {
      return obj.fetch(request);
    }
    // Route untuk WebSocket TinyBase (sinkronisasi)
    if (upgradeHeader && upgradeHeader.toLowerCase() === "websocket") {
      return obj.fetch(request);
    }
    // Default response kalau bukan dua-duanya
    return new Response("TinyBase WebSocket aktif di Worker ini!", {
      status: 200,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  },
};
