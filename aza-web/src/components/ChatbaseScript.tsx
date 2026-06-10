'use client';

import { usePathname } from 'next/navigation';
import Script from 'next/script';

// Only load the Chatbase chat widget on marketing pages.
// Excluded from /developers/* to prevent third-party JS running alongside
// sessionStorage-persisted API tokens in the developer portal.
export function ChatbaseScript() {
  const pathname = usePathname();
  if (pathname.startsWith('/developers')) return null;

  return (
    <Script
      id="chatbase-init"
      strategy="afterInteractive"
      dangerouslySetInnerHTML={{
        __html: `(function(){if(!window.chatbase||window.chatbase("getState")!=="initialized"){window.chatbase=(...arguments)=>{if(!window.chatbase.q){window.chatbase.q=[]}window.chatbase.q.push(arguments)};window.chatbase=new Proxy(window.chatbase,{get(target,prop){if(prop==="q"){return target.q}return(...args)=>target(prop,...args)}})}const onLoad=function(){const script=document.createElement("script");script.src="https://www.chatbase.co/embed.min.js";script.id="lcXHLFPWBcPsUbKaDDbeK";script.domain="www.chatbase.co";document.body.appendChild(script)};if(document.readyState==="complete"){onLoad()}else{window.addEventListener("load",onLoad)}})();`,
      }}
    />
  );
}
