import * as express from "express"
import { Router } from "express"
import { Request, Response } from "./authentication.js"

// Little wrapper to automatically send returned objects as JSON, makes
// the API code a bit cleaner
export class FunctionalRouter {
    router: Router
    constructor() {
        this.router = Router()
        this.router.use(express.urlencoded({ extended: true }))
        // Parse incoming requests with JSON payloads http://expressjs.com/en/api.html
        this.router.use(express.json({ limit: "50mb" }))
    }

    wrap(callback: (req: Request, res: Response) => Promise<any>) {
        return async (req: Request, res: Response) => {
            try {
                res.send(await callback(req, res))
            } catch (e) {
                // log errors to stderr and rethrow
                console.error(e)
                throw e
            }
        }
    }

    get(
        targetPath: string,
        callback: (req: Request, res: Response) => Promise<any>
    ) {
        this.router.get(targetPath, this.wrap(callback))
    }

    post(
        targetPath: string,
        callback: (req: Request, res: Response) => Promise<any>
    ) {
        this.router.post(targetPath, this.wrap(callback))
    }

    patch(
        targetPath: string,
        callback: (req: Request, res: Response) => Promise<any>
    ) {
        this.router.patch(targetPath, this.wrap(callback))
    }

    put(
        targetPath: string,
        callback: (req: Request, res: Response) => Promise<any>
    ) {
        this.router.put(targetPath, this.wrap(callback))
    }

    delete(
        targetPath: string,
        callback: (req: Request, res: Response) => Promise<any>
    ) {
        this.router.delete(targetPath, this.wrap(callback))
    }
}
