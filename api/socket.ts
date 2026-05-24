/**
 * Socket.io singleton.
 * Call initIo() once at server startup. Any module that needs to emit
 * can then call getIo() without creating a circular dependency on index.ts.
 */
import { Server } from 'socket.io'
import type { Server as HttpServer } from 'http'

let _io: Server | null = null

/**
 * Creates the Socket.io server, attaches it to the HTTP server, and stores
 * the instance for later retrieval via getIo(). Must be called exactly once.
 * @param httpServer - The Node.js HTTP server that Express is bound to
 * @param frontendOrigin - CORS origin to allow (e.g. 'http://localhost:5173')
 * @returns The initialized Socket.io Server instance
 */
export function initIo(httpServer: HttpServer, frontendOrigin: string): Server {
    _io = new Server(httpServer, {
        cors: {
            origin: frontendOrigin,
            methods: ['GET', 'POST'],
        },
    })
    return _io
}

/**
 * Returns the Socket.io Server instance.
 * Throws if initIo() has not been called yet.
 * @returns The active Socket.io Server instance
 */
export function getIo(): Server {
    if (!_io) throw new Error('Socket.io not initialized — call initIo() first')
    return _io
}
