// Общий тип Telegram WebApp SDK (то подмножество, что мы реально используем
// на клиенте). Augment'им глобальный Window, чтобы оба клиентских компонента
// (TelegramInit и AutoBootstrap) тыкали одну форму.
export type TgWebApp = {
  initData: string;
  initDataUnsafe?: { start_param?: string };
  ready?: () => void;
  expand?: () => void;
  close?: () => void;
  // Task 9 (invite): открыть t.me-ссылку нативно. Внутри Telegram WebView
  // обычный window.open часто ничего не делает (попапы блокируются) - это
  // официальный способ открыть t.me/share/url без разрыва мини-аппа.
  openTelegramLink?: (url: string) => void;
};

declare global {
  interface Window {
    Telegram?: { WebApp?: TgWebApp };
  }
}
