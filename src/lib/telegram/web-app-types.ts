// Общий тип Telegram WebApp SDK (то подмножество, что мы реально используем
// на клиенте). Augment'им глобальный Window, чтобы оба клиентских компонента
// (TelegramInit и AutoBootstrap) тыкали одну форму.
export type TgWebApp = {
  initData: string;
  initDataUnsafe?: { start_param?: string };
  ready?: () => void;
  expand?: () => void;
  close?: () => void;
};

declare global {
  interface Window {
    Telegram?: { WebApp?: TgWebApp };
  }
}
