// See https://kit.svelte.dev/docs/types#app
declare global {
  namespace App {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface Error {}
    interface Locals {
      user: {
        id: string;
        name: string;
        email: string;
        color: string;
      } | null;
    }
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface PageData {}
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface PageState {}
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface Platform {}
  }
}

export {};
