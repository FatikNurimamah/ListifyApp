import { createMergeableStore } from "tinybase";
import { createDurableObjectStoragePersister } from "tinybase/persisters/persister-durable-object-storage";
import {
  getWsServerDurableObjectFetch,
  WsServerDurableObject,
} from "tinybase/synchronizers/synchronizer-ws-server-durable-object";

export class GroceriesDurableObject extends WsServerDurableObject {
  createPersister() {
    return createDurableObjectStoragePersister(
      createMergeableStore(),
      this.ctx.storage
    );
  }
}

export default {
  async fetch(request: Request, env: any, ctx: ExecutionContext) {
    const upgradeHeader = request.headers.get("Upgrade");

    // Jika ini permintaan WebSocket
    if (upgradeHeader && upgradeHeader.toLowerCase() === "websocket") {
      const id = env.GroceriesDurableObjects.idFromName("main");
      const obj = env.GroceriesDurableObjects.get(id);
      return obj.fetch(request);
    }

    // Kalau bukan WebSocket
    return new Response("TinyBase WebSocket aktif di Worker ini!", {
      status: 200,
      headers: { "content-type": "text/plain" },
    });
  },
  DurableObject: {
  GroceriesDurableObject,
},
};
