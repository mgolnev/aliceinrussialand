"use client";

import Script from "next/script";
import { parseYandexCounterId } from "@/lib/yandex-metrika";

type Props = {
  plausibleDomain?: string;
  /** Номер счётчика Яндекс.Метрики (только цифры) или из админки / NEXT_PUBLIC_YANDEX_METRIKA_ID */
  yandexMetrikaId?: string;
};

export function Analytics({ plausibleDomain, yandexMetrikaId }: Props) {
  const ymId = parseYandexCounterId(yandexMetrikaId);

  return (
    <>
      {plausibleDomain ? (
        <Script
          data-domain={plausibleDomain}
          src="https://plausible.io/js/script.outbound-links.tagged-events.js"
          strategy="lazyOnload"
        />
      ) : null}
      {ymId != null ? (
        <>
          <Script id="yandex-metrika" strategy="lazyOnload">
            {`
(function(m,e,t,r,i,k,a){m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
m[i].l=1*new Date();
for (var j = 0; j < document.scripts.length; j++) { if (document.scripts[j].src === r) { return; } }
k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)})
(window, document, "script", "https://mc.yandex.ru/metrika/tag.js", "ym");

ym(${ymId}, "init", {
  clickmap:true,
  trackLinks:true,
  accurateTrackBounce:true,
  webvisor:false
});
            `}
          </Script>
          <noscript>
            <div>
              {/* eslint-disable-next-line @next/next/no-img-element -- пиксель Метрики для пользователей без JS */}
              <img
                src={`https://mc.yandex.ru/watch/${ymId}`}
                style={{ position: "absolute", left: "-9999px" }}
                alt=""
                width={1}
                height={1}
              />
            </div>
          </noscript>
        </>
      ) : null}
    </>
  );
}
