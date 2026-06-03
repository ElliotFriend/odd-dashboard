import type { Meta } from '$lib/types';

// See https://svelte.dev/docs/kit/types#app.d.ts for the ambient `App` namespace.
declare global {
    namespace App {
        // interface Error {}
        // interface Locals {}
        interface PageData {
            meta: Meta;
        }
        // interface PageState {}
        // interface Platform {}
    }
}

export {};
