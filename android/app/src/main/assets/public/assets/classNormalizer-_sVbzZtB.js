import{L as me,M as fe,al as Q,ak as he,an as S,aq as ee,ar as Se,ao as Ee,u as ve,j as a}from"./main-CyAeFhsY.js";import{a as O,b as we,N as le,X as De,p as je,q as ke,t as Ce,O as Ae,I as ie,a5 as Me,br as ce,bB as $e,ai as Te,ax as de,az as Ve}from"./vendor-icons-CL6AnbsU.js";import{E as xe,h as be}from"./vendor-export-pdf-Cavo-5q4.js";import{C as I,F as H,D as J,S as Y}from"./vendor-capacitor-storage-D5SWkiJ2.js";function pe(s){if(!s)return"";const r=s.trim(),e=r.match(/\d+/);if(e)return e[0];const t=r.match(/^[a-zA-Z\u0621-\u064A]+/);return t?t[0]:r.toLowerCase()}function K(s,r,e={}){var C;const t=s||me(r),o=e.language||(r==null?void 0:r.language)||"ar",n=o==="ar",p=[{key:"0",labelAr:"الأحد",labelEn:"Sunday",labelDe:"Sonntag",shortAr:"أحد",shortEn:"Sun",shortDe:"So"},{key:"1",labelAr:"الإثنين",labelEn:"Monday",labelDe:"Montag",shortAr:"اثنين",shortEn:"Mon",shortDe:"Mo"},{key:"2",labelAr:"الثلاثاء",labelEn:"Tuesday",labelDe:"Dienstag",shortAr:"ثلاثاء",shortEn:"Tue",shortDe:"Di"},{key:"3",labelAr:"الأربعاء",labelEn:"Wednesday",labelDe:"Mittwoch",shortAr:"أربعاء",shortEn:"Wed",shortDe:"Mi"},{key:"4",labelAr:"الخميس",labelEn:"Thursday",labelDe:"Donnerstag",shortAr:"خميس",shortEn:"Thu",shortDe:"Do"},{key:"5",labelAr:"الجمعة",labelEn:"Friday",labelDe:"Freitag",shortAr:"جمعة",shortEn:"Fri",shortDe:"Fr"},{key:"6",labelAr:"السبت",labelEn:"Saturday",labelDe:"Samstag",shortAr:"سبت",shortEn:"Sat",shortDe:"Sa"}],c=[];p.forEach(g=>{const z=t.presence[g.key];if(z?z.active:["0","1","2","3","4"].includes(g.key)){const G=o==="ar"?g.labelAr:o==="de"?g.labelDe:g.labelEn,j=o==="ar"?g.shortAr:o==="de"?g.shortDe:g.shortEn,R=z?`${z.arrivalTime} - ${z.departureTime}`:void 0;c.push({key:g.key,label:G,short:j,isActive:!0,presenceTime:R})}}),c.length===0&&p.slice(0,5).forEach(g=>{c.push({key:g.key,label:o==="ar"?g.labelAr:o==="de"?g.labelDe:g.labelEn,short:o==="ar"?g.shortAr:o==="de"?g.shortDe:g.shortEn,isActive:!0})});const i=fe(t.periodSettings),u=[],y=new Set;c.forEach(g=>{Q(t.customTimedSessions,g.key,i).forEach(P=>{const G=`${P.startTime}-${P.endTime}`;if(!y.has(G)){y.add(G);const j=i.length+u.length+1;u.push({periodNumber:j,startTime:P.startTime,endTime:P.endTime||P.startTime,duration:45,isCustom:!0})}})});const d=[...i,...u],l=new Set,b=new Set;let x=0;const h={};d.forEach(g=>{h[g.periodNumber]={};const z=g.periodNumber<=i.length;c.forEach(P=>{var oe,se,ne;const G=t.schedule[P.key]||[],j=z?G.find(F=>F.periodNumber===g.periodNumber):void 0;let R=[];z?R=he(t.customTimedSessions,P.key,g.periodNumber,i):R=Q(t.customTimedSessions,P.key,i).filter(B=>B.startTime===g.startTime);let _=((oe=j==null?void 0:j.className)==null?void 0:oe.trim())||"",Z=((se=j==null?void 0:j.subjectName)==null?void 0:se.trim())||"",ae=((ne=j==null?void 0:j.notes)==null?void 0:ne.trim())||"";if(R.length>0){const F=R.map(B=>`${B.className} [⏱️ ${B.startTime}-${B.endTime}]`).join(" • ");_?_=`${_} / ${F}`:(_=F,Z=R[0].subjectName||(o==="ar"?"حصة مخصصة":"Custom"),ae=R[0].notes||"")}const re=!!(_||Z);if(re){if(j!=null&&j.className&&j.className.trim()){l.add(j.className.trim());const F=pe(j.className);F&&b.add(F)}R.forEach(F=>{if(F.className){l.add(F.className.trim());const B=pe(F.className);B&&b.add(B)}}),x+=(j&&(j.className||j.subjectName)?1:0)+R.length}h[g.periodNumber][P.key]={periodNumber:g.periodNumber,dayKey:P.key,className:_,subjectName:Z,notes:ae,isFilled:re}})});const N=l.size,k=b.size;let V="";o==="ar"?V=`${N} فصول • ${k} مراحل • ${x} حصة أسبوعياً`:o==="de"?V=`${N} Klassen • ${k} Stufen • ${x} Wochenstunden`:V=`${N} Classes • ${k} Stages • ${x} Weekly Lessons`;let m="جدول المدرسة الأسبوعي",E="Glück Teacher Assistant";o==="de"?(m="Wöchentlicher Schulstundenplan",E="Glück Unterrichts-Assistent"):o==="en"&&(m="Weekly School Schedule",E="Glück Teacher Assistant");const D=new Date,A={day:"numeric",month:"long",year:"numeric"},L=o==="ar"?"ar-EG":o==="de"?"de-DE":"en-US",U=D.toLocaleDateString(L,A),f=((C=c[0])==null?void 0:C.presenceTime)||"07:30 - 14:30",T=D.getFullYear(),v=String(D.getMonth()+1).padStart(2,"0"),M=String(D.getDate()).padStart(2,"0"),w=`School_Schedule${r!=null&&r.displayName?`_${r.displayName.replace(/\s+/g,"_")}`:""}_${T}-${v}-${M}`;return{title:m,subtitle:E,teacherName:(r==null?void 0:r.displayName)||"",schoolPresenceTimes:f,exportDateFormatted:U,filenameBase:w,isRtl:n,language:o,stats:{totalClasses:N,totalStages:k,totalWeeklyLessons:x,summaryLine:V},days:c,periods:d,cellsByPeriod:h}}function Ne(s,r={}){const t=(r.theme||"clean_light")==="brand_accent",o=s.isRtl,n=document.createElement("div");n.id=`school-export-canvas-${Date.now()}`,n.style.position="fixed",n.style.left="-9999px",n.style.top="-9999px",n.style.width="1480px",n.style.minHeight="1046px",n.style.zIndex="-9999",n.style.backgroundColor="#ffffff",n.style.color="#000000",n.style.fontFamily=o?"'Cairo', 'Alexandria', 'Amiri', system-ui, -apple-system, sans-serif":"'Plus Jakarta Sans', system-ui, -apple-system, sans-serif",n.style.direction=o?"rtl":"ltr",n.style.boxSizing="border-box",n.style.padding="28px 36px",n.style.display="flex",n.style.flexDirection="column",n.style.justifyContent="space-between";const p=t?"#f0f9ff":"#f8fafc",c="#000000",i=s.days.length,u=i>5?"13%":"15%",y=`${(100-(i>5?13:15))/i}%`,d=s.language==="ar"?"الحصة / التوقيت":s.language==="de"?"Stunde / Zeit":"Period / Time",l=s.language==="ar"?"تاريخ الطباعة:":s.language==="de"?"Druckdatum:":"Print Date:",b=s.language==="ar"?"المعلم:":s.language==="de"?"Lehrkraft:":"Teacher:",x=s.periods.map(N=>{const k=N.isCustom?s.language==="ar"?"حصة مخصصة":s.language==="de"?"Spez. Stunde":"Custom Session":s.language==="ar"?`الحصة ${N.periodNumber}`:s.language==="de"?`Std. ${N.periodNumber}`:`Period ${N.periodNumber}`,V=s.days.map(m=>{var A;const E=(A=s.cellsByPeriod[N.periodNumber])==null?void 0:A[m.key];return E&&E.isFilled?`
        <td style="width: ${y}; padding: 4px; border: 2px solid ${c}; background: ${p}; text-align: center; vertical-align: middle;">
          <div style="box-sizing: border-box; border: 2px solid ${c}; border-radius: 8px; padding: 6px 4px; background: #ffffff; text-align: center; min-height: 76px; display: table; width: 100%; box-shadow: 0 1px 3px rgba(0,0,0,0.06);">
            <div style="display: table-cell; vertical-align: middle; text-align: center;">
              ${E.className?`
                <div style="display: block; font-weight: 900; font-size: 34px; color: #000000; line-height: 1.1; margin: 0; letter-spacing: -0.5px; word-break: break-word;">
                  ${S(E.className)}
                </div>
              `:""}
              ${E.subjectName?`
                <div style="display: inline-block; font-weight: 900; font-size: 15px; color: #0f172a; line-height: 1.2; background: #f1f5f9; padding: 3px 10px; border-radius: 6px; border: 1.5px solid #94a3b8; margin-top: 4px; word-break: break-word;">
                  ${S(E.subjectName)}
                </div>
              `:""}
              ${E.notes?`
                <div style="display: block; font-weight: 800; font-size: 13px; color: #334155; line-height: 1.15; margin-top: 3px;">
                  ${S(E.notes)}
                </div>
              `:""}
            </div>
          </div>
        </td>
      `:`
          <td style="width: ${y}; padding: 4px; border: 2px solid ${c}; background: #ffffff; text-align: center; vertical-align: middle;">
            <div style="min-height: 76px; display: table; width: 100%;">
              <div style="display: table-cell; vertical-align: middle; text-align: center;">
                <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background-color: #cbd5e1;"></span>
              </div>
            </div>
          </td>
        `}).join("");return`
      <tr>
        <td style="width: ${u}; padding: 6px 4px; border: 2px solid ${c}; background: #f8fafc; text-align: center; vertical-align: middle;">
          <div style="display: block; font-weight: 900; font-size: 24px; color: #000000; line-height: 1.15; margin-bottom: 4px;">
            ${S(k)}
          </div>
          <div style="display: inline-block; font-weight: 900; font-size: 18px; color: #000000; line-height: 1.2; font-family: 'Cairo', monospace, system-ui; margin: 0; background: #e2e8f0; padding: 3px 8px; border-radius: 6px; border: 1.5px solid #94a3b8; letter-spacing: 0.3px;">
            ${S(N.startTime)} - ${S(N.endTime)}
          </div>
        </td>
        ${V}
      </tr>
    `}).join(""),h=s.days.map(N=>`
    <th style="width: ${y}; padding: 14px 6px; border: 2px solid ${c}; background: #0f172a; text-align: center; font-size: 30px; font-weight: 900; color: #ffffff; letter-spacing: -0.2px;">
      <div>${S(N.label)}</div>
    </th>
  `).join("");return n.innerHTML=`
    <!-- HEADER AREA -->
    <div style="border-bottom: 3px solid #000000; padding-bottom: 14px; margin-bottom: 14px; display: flex; align-items: flex-end; justify-content: space-between;">
      <div>
        <div style="display: flex; align-items: center; gap: 12px;">
          <div style="width: 40px; height: 40px; border-radius: 8px; background: #000000; color: #ffffff; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 22px;">
            📖
          </div>
          <h1 style="margin: 0; font-size: 32px; font-weight: 900; color: #000000; letter-spacing: -0.5px;">
            ${S(s.title)}
          </h1>
        </div>
        <div style="display: flex; align-items: center; gap: 10px; margin-top: 8px; font-size: 16px; font-weight: 800; color: #000000;">
          ${s.teacherName?`
            <span style="background: #f8fafc; padding: 6px 16px; border-radius: 8px; border: 2.5px solid #000000; color: #000000; font-size: 22px; font-weight: 900;">
              ${S(b)} <strong>${S(s.teacherName)}</strong>
            </span>
          `:""}
          <span style="background: #f1f5f9; padding: 6px 14px; border-radius: 8px; border: 1.5px solid #94a3b8; font-weight: 900; font-size: 16px; color: #0f172a;">
            ${S(s.stats.summaryLine)}
          </span>
        </div>
      </div>

      <div style="text-align: ${o?"left":"right"};">
        <div style="font-size: 20px; font-weight: 900; color: #000000; letter-spacing: 0.5px;">
          GLÜCK
        </div>
        <div style="font-size: 14px; font-weight: 800; color: #334155; margin-top: 2px;">
          ${S(l)} ${S(s.exportDateFormatted)}
        </div>
      </div>
    </div>

    <!-- MAIN SCHEDULE TABLE -->
    <div style="flex: 1; display: flex; flex-direction: column; justify-content: flex-start;">
      <table style="width: 100%; border-collapse: collapse; border: 3px solid ${c}; table-layout: fixed;">
        <thead>
          <tr>
            <th style="width: ${u}; padding: 14px 6px; border: 2px solid ${c}; background: #0f172a; text-align: center; font-size: 20px; font-weight: 900; color: #ffffff;">
              ${S(d)}
            </th>
            ${h}
          </tr>
        </thead>
        <tbody>
          ${x}
        </tbody>
      </table>
    </div>

    <!-- FOOTER AREA -->
    <div style="margin-top: 14px; padding-top: 10px; border-top: 2px solid #000000; display: flex; align-items: center; justify-content: space-between; font-size: 14px; font-weight: 800; color: #334155;">
      <div>
        Glück Teacher Assistant • ${s.stats.totalWeeklyLessons} ${s.language==="ar"?"حصة أسبوعية":s.language==="de"?"Wochenstunden":"Weekly Lessons"}
      </div>
      <div>
        A4 Landscape Format • ${S(s.exportDateFormatted)}
      </div>
    </div>
  `,n}async function te(s,r={}){await new Promise(t=>setTimeout(t,50));let e=null;try{if(e=Ne(s,r),document.body.appendChild(e),document.fonts&&document.fonts.ready)try{await document.fonts.ready}catch{}await new Promise(p=>setTimeout(p,80));const t=I.isNativePlatform(),o=r.scale||(t?2:2.5);return await be(e,{scale:o,useCORS:!0,allowTaint:!1,imageTimeout:8e3,logging:!1,backgroundColor:"#ffffff",width:e.offsetWidth||1480,height:e.offsetHeight||1046,onclone:p=>{p.documentElement.classList.remove("dark"),p.body&&(p.body.classList.remove("dark"),p.body.style.backgroundColor="#ffffff"),p.querySelectorAll("style").forEach(i=>{i.textContent&&(i.textContent=Ee(i.textContent))})}})}finally{if(e&&document.body.contains(e))try{document.body.removeChild(e)}catch(t){console.warn("Error cleaning up export canvas container:",t)}}}async function Le(s,r,e={}){try{const t=e.format==="jpeg"?"jpeg":"png",o=K(s,r,e),n=await te(o,e),p=t==="jpeg"?"image/jpeg":"image/png",c=e.quality||.98,i=n.toDataURL(p,c),u=`${o.filenameBase}.${t==="jpeg"?"jpg":"png"}`;if(I.isNativePlatform())try{const b=i.split(",")[1];return await H.writeFile({path:u,data:b,directory:J.Documents}),{success:!0,filename:u}}catch(b){console.warn("Capacitor native save warning:",b)}const y=ee(i),d=URL.createObjectURL(y),l=document.createElement("a");return l.href=d,l.download=u,document.body.appendChild(l),l.click(),setTimeout(()=>{document.body.contains(l)&&document.body.removeChild(l),URL.revokeObjectURL(d)},1e3),{success:!0,filename:u}}catch(t){return console.error("Error exporting school schedule as image:",t),{success:!1,error:(t==null?void 0:t.message)||"Failed to export image"}}}async function ge(s,r,e={}){try{const t=K(s,r,{...e,format:"pdf"}),n=(await te(t,e)).toDataURL("image/jpeg",.98),p=new xe({orientation:"landscape",unit:"mm",format:"a4"}),c=p.internal.pageSize.getWidth(),i=p.internal.pageSize.getHeight();p.addImage(n,"JPEG",0,0,c,i,void 0,"FAST"),p.setProperties({title:t.title,subject:t.stats.summaryLine,author:t.teacherName||"Glück Teacher Assistant",keywords:"School Schedule, Stundenplan, Glück",creator:"Glück Teacher Assistant"});const u=`${t.filenameBase}.pdf`;if(I.isNativePlatform())try{const b=p.output("datauristring").split(",")[1];return await H.writeFile({path:u,data:b,directory:J.Documents}),{success:!0,filename:u}}catch(b){console.warn("Capacitor native PDF save warning:",b)}const y=p.output("blob"),d=URL.createObjectURL(y),l=document.createElement("a");return l.href=d,l.download=u,document.body.appendChild(l),l.click(),setTimeout(()=>{document.body.contains(l)&&document.body.removeChild(l),URL.revokeObjectURL(d)},1e3),{success:!0,filename:u}}catch(t){return console.error("Error exporting school schedule as PDF:",t),{success:!1,error:(t==null?void 0:t.message)||"Failed to export PDF"}}}async function ye(s,r,e={}){try{const{icsContent:t,filename:o}=Se(s,r,{language:e.language||(r==null?void 0:r.language)||"ar",includePresence:e.includeSchoolTimes??!1});if(I.isNativePlatform())try{const i=await H.writeFile({path:o,data:t,directory:J.Cache});return await Y.share({title:"School Schedule Calendar Export",text:`Glück School Schedule - ${o}`,url:i.uri,dialogTitle:e.language==="ar"?"حفظ / استيراد ملف التقويم":"Save / Import Calendar (.ics)"}),{success:!0,filename:o,icsContent:t}}catch(i){console.warn("Capacitor native ICS share warning:",i)}const n=new Blob([t],{type:"text/calendar;charset=utf-8"}),p=URL.createObjectURL(n),c=document.createElement("a");return c.href=p,c.download=o,document.body.appendChild(c),c.click(),setTimeout(()=>{document.body.contains(c)&&document.body.removeChild(c),URL.revokeObjectURL(p)},1e3),{success:!0,filename:o,icsContent:t}}catch(t){return console.error("Error exporting school schedule as ICS:",t),{success:!1,error:(t==null?void 0:t.message)||"Failed to export ICS"}}}async function Pe(s,r,e={}){try{const t=e.format||"png",o=K(s,r,e);if(t==="ics")return ye(s,r,e);if(t==="pdf")return ge(s,r,e);const n=await te(o,e),p=t==="jpeg"?"image/jpeg":"image/png",c=n.toDataURL(p,.98),i=`${o.filenameBase}.${t==="jpeg"?"jpg":"png"}`;if(I.isNativePlatform()){const l=c.split(",")[1],b=await H.writeFile({path:i,data:l,directory:J.Documents});return await Y.share({title:i,url:b.uri,dialogTitle:o.language==="ar"?"مشاركة جدول المدرسة":"Share School Schedule"}),{success:!0}}const u=ee(c),y=URL.createObjectURL(u),d=document.createElement("a");return d.href=y,d.download=i,d.style.display="none",document.body.appendChild(d),d.click(),setTimeout(()=>{document.body.contains(d)&&document.body.removeChild(d),URL.revokeObjectURL(y)},4e3),{success:!0}}catch(t){return console.error("Error sharing school schedule:",t),{success:!1,error:(t==null?void 0:t.message)||"Failed to share schedule"}}}function Fe(s,r,e={}){try{const t=K(s,r,e),o=Ne(t,e),n=window.open("","_blank");return n?(n.document.write(`
      <!DOCTYPE html>
      <html dir="${t.isRtl?"rtl":"ltr"}" lang="${t.language}">
      <head>
        <meta charset="utf-8">
        <title>${S(t.title)} - ${S(t.teacherName||"Glück")}</title>
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@700;800;900&display=swap" rel="stylesheet">
        <style>
          @page {
            size: A4 landscape;
            margin: 6mm;
          }
          * {
            box-sizing: border-box;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          body {
            margin: 0;
            padding: 0;
            background: #ffffff;
            font-family: ${t.isRtl?"'Cairo', sans-serif":"system-ui, sans-serif"};
            display: flex;
            justify-content: center;
            align-items: flex-start;
          }
          #print-wrapper {
            width: 100%;
            max-width: 100%;
          }
          #print-wrapper > div {
            position: static !important;
            left: auto !important;
            top: auto !important;
            width: 100% !important;
            min-height: auto !important;
            padding: 10px !important;
          }
          @media print {
            body {
              width: 100%;
              height: 100%;
            }
          }
        </style>
      </head>
      <body>
        <div id="print-wrapper">
          ${o.outerHTML}
        </div>
        <script>
          window.onload = function() {
            setTimeout(function() {
              window.focus();
              window.print();
            }, 250);
          };
        <\/script>
      </body>
      </html>
    `),n.document.close(),{success:!0}):(window.print(),{success:!0})}catch(t){return console.error("Direct print failed:",t),{success:!1,error:(t==null?void 0:t.message)||"Print failed"}}}async function X(s,r,e,t){try{const o=e.language==="ar"||r.language==="ar",n=Ue(s,e,o);if(document.body.appendChild(n),document.fonts&&document.fonts.ready)try{await document.fonts.ready}catch{}await new Promise(u=>setTimeout(u,80));const p=await be(n,{scale:2.5,useCORS:!0,allowTaint:!1,logging:!1,backgroundColor:"#ffffff",width:n.offsetWidth,height:n.offsetHeight,onclone:u=>{u.documentElement.classList.remove("dark"),u.body&&(u.body.classList.remove("dark"),u.body.style.backgroundColor="#ffffff")}});n&&document.body.contains(n)&&document.body.removeChild(n);const c=e.language==="ar"?"الجدول الموحد":"Master Schedule",i=`Master_Schedule_${Date.now()}`;if(t==="pdf"){const u=p.toDataURL("image/jpeg",.98),y=new xe({orientation:"landscape",unit:"mm",format:"a4"}),d=y.internal.pageSize.getWidth(),l=y.internal.pageSize.getHeight();y.addImage(u,"JPEG",0,0,d,l,void 0,"FAST");const b=`${i}.pdf`;if(I.isNativePlatform()){const x=y.output("datauristring").split(",")[1],h=await H.writeFile({path:b,data:x,directory:J.Documents});await Y.share({title:b,url:h.uri})}else y.save(b);return{success:!0,filename:b}}else{const u=e.format==="jpeg"?"jpeg":"png",y=u==="jpeg"?"image/jpeg":"image/png",d=p.toDataURL(y,.98),l=`${i}.${u==="jpeg"?"jpg":"png"}`;if(I.isNativePlatform()){const b=d.split(",")[1],x=await H.writeFile({path:l,data:b,directory:J.Documents});await Y.share({title:l,url:x.uri})}else{const b=ee(d),x=URL.createObjectURL(b),h=document.createElement("a");h.href=x,h.download=l,document.body.appendChild(h),h.click(),setTimeout(()=>URL.revokeObjectURL(x),1e3)}return{success:!0,filename:l}}}catch(o){return console.error(o),{success:!1,error:o.message}}}function Ue(s,r,e){const t=document.createElement("div");t.id=`master-export-${Date.now()}`,t.style.position="fixed",t.style.left="-9999px",t.style.top="-9999px",t.style.width="1480px",t.style.minHeight="1046px",t.style.backgroundColor="#ffffff",t.style.color="#000000",t.style.fontFamily=e?"'Cairo', sans-serif":"sans-serif",t.style.direction=e?"rtl":"ltr",t.style.boxSizing="border-box",t.style.padding="30px";const o=document.createElement("h1");o.innerText=e?"الجدول الأسبوعي الموحد لجميع المعلمين":"Unified Weekly Master Schedule",o.style.textAlign="center",o.style.fontSize="26px",o.style.fontWeight="900",o.style.color="#0f172a",o.style.marginBottom="16px",t.appendChild(o);const n=document.createElement("table");n.style.width="100%",n.style.borderCollapse="collapse",n.style.tableLayout="fixed",n.style.border="2px solid #0f172a";const p=document.createElement("thead"),c=document.createElement("tr"),i=document.createElement("th");i.innerText=e?"الحصة / التوقيت":"Period / Time",i.style.border="2.5px solid #000000",i.style.padding="10px 4px",i.style.backgroundColor="#0f172a",i.style.color="#ffffff",i.style.fontSize="18px",i.style.fontWeight="900",i.style.width="130px",c.appendChild(i);const u=s.teachers||[];u.forEach(x=>{const h=document.createElement("th");h.innerText=x.name,h.style.border="2.5px solid #000000",h.style.padding="10px 4px",h.style.backgroundColor="#0f172a",h.style.color="#ffffff",h.style.fontSize="18px",h.style.fontWeight="900",h.style.overflow="hidden",h.style.wordBreak="break-word",c.appendChild(h)}),p.appendChild(c),n.appendChild(p);const y=document.createElement("tbody"),d=["0","1","2","3","4"],l=e?["الأحد","الإثنين","الثلاثاء","الأربعاء","الخميس"]:["Sun","Mon","Tue","Wed","Thu"],b=fe(s.periodSettings);return d.forEach((x,h)=>{const N=document.createElement("tr"),k=document.createElement("td");k.colSpan=u.length+1,k.innerText=l[h],k.style.backgroundColor="#0f172a",k.style.color="#ffffff",k.style.fontWeight="900",k.style.fontSize="26px",k.style.textAlign="center",k.style.padding="10px",k.style.border="2.5px solid #000000",N.appendChild(k),y.appendChild(N),b.forEach(m=>{const E=document.createElement("tr"),D=document.createElement("td");D.innerHTML=`
        <div style="font-weight: 900; font-size: 20px; color: #000000; margin-bottom: 3px; line-height: 1;">${e?"حصة ":"P"}${S(m.periodNumber)}</div>
        <div style="font-weight: 900; font-size: 13px; color: #000000; font-family: 'Cairo', monospace, sans-serif; background: #e2e8f0; padding: 2px 6px; border-radius: 4px; border: 1.5px solid #94a3b8; display: inline-block; white-space: nowrap;">${S(m.startTime)} - ${S(m.endTime)}</div>
      `,D.style.border="2px solid #000000",D.style.backgroundColor="#f8fafc",D.style.padding="6px 2px",D.style.textAlign="center",E.appendChild(D),u.forEach(A=>{var M,$,w;const L=document.createElement("td");L.style.border="2px solid #000000",L.style.padding="4px 2px",L.style.textAlign="center",L.style.verticalAlign="middle",L.style.backgroundColor="#ffffff";let U=[];A.id==="hod"?U=((M=s.schedule)==null?void 0:M[x])||[]:U=((w=($=s.teacherSchedules)==null?void 0:$[A.id])==null?void 0:w[x])||[];const f=U.find(C=>C.periodNumber===m.periodNumber&&(C.className||C.subjectName)),T=he(s.customTimedSessions,x,m.periodNumber,b,A.id);let v="";f&&(v+=`
            <div style="font-weight: 900; font-size: 24px; color: #000000; line-height: 1.1; margin: 0; letter-spacing: -0.3px;">${S(f.className||"")}</div>
            ${f.subjectName?`<div style="font-weight: 900; font-size: 13px; color: #0f172a; background: #f1f5f9; padding: 2px 6px; border-radius: 4px; border: 1px solid #cbd5e1; margin-top: 3px; display: inline-block;">${S(f.subjectName)}</div>`:""}
          `),T.forEach(C=>{v+=`
            <div style="margin-top: ${f?"4px":"0"}; padding: 3px 2px; background: #e0e7ff; border: 1.5px solid #818cf8; border-radius: 5px;">
              <div style="font-weight: 900; font-size: 20px; color: #1e1b4b; line-height: 1.1; margin: 0;">${S(C.className||"")}</div>
              <div style="font-weight: 900; font-size: 12px; color: #3730a3; font-family: monospace; margin-top: 2px; display: inline-block;">⏱️ ${S(C.startTime)}-${S(C.endTime)}</div>
              ${C.subjectName?`<div style="font-weight: 900; font-size: 12px; color: #312e81; background: #ffffff; padding: 1px 5px; border-radius: 3px; border: 1px solid #c7d2fe; margin-top: 2px; display: inline-block;">${S(C.subjectName)}</div>`:""}
            </div>
          `}),L.innerHTML=v,E.appendChild(L)}),y.appendChild(E)});const V=Q(s.customTimedSessions,x,b);if(V.length>0){const m=document.createElement("tr"),E=document.createElement("td");E.innerHTML=`
        <div style="font-weight: 900; font-size: 16px; color: #3730a3; margin-bottom: 2px; line-height: 1.1;">⏱️ ${e?"مخصص":"Custom"}</div>
        <div style="font-weight: 800; font-size: 11px; color: #4338ca;">${e?"خارج الحصص":"Extended"}</div>
      `,E.style.border="2px solid #6366f1",E.style.backgroundColor="#eef2ff",E.style.padding="6px 2px",E.style.textAlign="center",m.appendChild(E),u.forEach(D=>{const A=document.createElement("td");A.style.border="2px solid #6366f1",A.style.padding="4px 2px",A.style.textAlign="center",A.style.verticalAlign="middle",A.style.backgroundColor="#f5f3ff";const L=V.filter(f=>f.teacherId===D.id);let U="";L.forEach(f=>{U+=`
            <div style="padding: 3px 2px; background: #e0e7ff; border: 1.5px solid #818cf8; border-radius: 5px; margin-bottom: 3px;">
              <div style="font-weight: 900; font-size: 20px; color: #1e1b4b; line-height: 1.1; margin: 0;">${S(f.className||"")}</div>
              <div style="font-weight: 900; font-size: 12px; color: #3730a3; font-family: monospace; margin-top: 2px; display: inline-block;">⏱️ ${S(f.startTime)}-${S(f.endTime)}</div>
              ${f.subjectName?`<div style="font-weight: 900; font-size: 12px; color: #312e81; background: #ffffff; padding: 1px 5px; border-radius: 3px; border: 1px solid #c7d2fe; margin-top: 2px; display: inline-block;">${S(f.subjectName)}</div>`:""}
            </div>
          `}),A.innerHTML=U,m.appendChild(A)}),y.appendChild(m)}}),n.appendChild(y),t.appendChild(n),t}const _e=({onClose:s})=>{const{profile:r,_t:e,language:t}=ve(),o=me(r),[n,p]=O.useState("pdf"),[c,i]=O.useState("clean_light"),[u,y]=O.useState(!1),[d,l]=O.useState(!1),[b,x]=O.useState(""),[h,N]=O.useState(null),[k,V]=O.useState(null),[m,E]=O.useState("my_schedule"),D=we.useMemo(()=>{var v,M;let f=o,T=(r==null?void 0:r.displayName)||"";if(m!=="my_schedule"&&m!=="master"){const $=(v=o==null?void 0:o.teachers)==null?void 0:v.find(w=>w.id===m);$&&(f={...o,schedule:((M=o.teacherSchedules)==null?void 0:M[m])||{}},T=$.name)}return m==="master"?{...K(o,r,{language:t}),title:e("الجدول الموحد للقسم","Unified Department Master Schedule","Abteilungsplan"),stats:{summaryLine:e("كافة المعلمين","All Teachers","Alle Lehrer")},teacherName:""}:K(f,{...r,displayName:T},{language:t})},[o,r,t,c,m,e]),A=async()=>{var f,T;if(!d){l(!0),N(null),x(e("جاري إعداد الجدول للتصدير...","Preparing schedule for export...","Stundenplan wird vorbereitet..."));try{let v=o,M=(r==null?void 0:r.displayName)||"";if(m!=="my_schedule"&&m!=="master"){const w=(f=o==null?void 0:o.teachers)==null?void 0:f.find(C=>C.id===m);w&&(v={...o,schedule:((T=o.teacherSchedules)==null?void 0:T[m])||{}},M=w.name)}const $={format:n,theme:c,language:t,includeSchoolTimes:u};if(n==="ics"){x(e("جاري إنشاء ملف التقويم .ics...","Generating calendar .ics file...","ICS-Kalenderdatei wird erstellt..."));const w=await ye(v,{...r,displayName:M},$);if(!w.success)throw new Error(w.error||"Failed to export ICS")}else if(n==="pdf"){x(e("جاري إنشاء مستند PDF عالي الجودة...","Generating high quality PDF...","Hochwertiges PDF wird erstellt..."));const w=m==="master"?await X(o,r,$,"pdf"):await ge(v,{...r,displayName:M},$);if(!w.success)throw new Error(w.error||"Failed to export PDF")}else{x(e("جاري معالجة الصورة بجودة عالية...","Rendering high resolution image...","Bild wird in hoher Qualität gerendert..."));const w=m==="master"?await X(o,r,$,"image"):await Le(v,{...r,displayName:M},$);if(!w.success)throw new Error(w.error||"Failed to export image")}V(e("تم تجهيز الملف وحفظه بنجاح!","File created and saved successfully!","Datei erfolgreich gespeichert!")),setTimeout(()=>{V(null),s()},1500)}catch(v){console.error("[Export School Schedule Error]:",v),N(e("تعذر إنشاء ملف التصدير. يرجى المحاولة مرة أخرى.","Failed to generate export file. Please try again.","Fehler beim Erstellen der Exportdatei. Bitte erneut versuchen."))}finally{l(!1),x("")}}},L=()=>{var f,T;try{let v=o,M=(r==null?void 0:r.displayName)||"";if(m!=="my_schedule"&&m!=="master"){const C=(f=o==null?void 0:o.teachers)==null?void 0:f.find(g=>g.id===m);C&&(v={...o,schedule:((T=o.teacherSchedules)==null?void 0:T[m])||{}},M=C.name)}const $={format:n,theme:c,language:t},w=Fe(v,{...r,displayName:M},$);if(!w.success)throw new Error(w.error||"Failed to print schedule")}catch(v){console.error("[Print School Schedule Error]:",v),N(e("تعذر فتح نافذة الطباعة مباشرة. يرجى تصدير ملف PDF والطباعة منه.","Could not open print window. Please export as PDF to print.","Druckfenster konnte nicht geöffnet werden. Bitte als PDF exportieren."))}},U=async()=>{var f,T;if(!d){l(!0),N(null),x(e("جاري تجهيز الملف للمشاركة...","Preparing file for sharing...","Datei wird für Freigabe vorbereitet..."));try{let v=o,M=(r==null?void 0:r.displayName)||"";if(m!=="my_schedule"&&m!=="master"){const C=(f=o==null?void 0:o.teachers)==null?void 0:f.find(g=>g.id===m);C&&(v={...o,schedule:((T=o.teacherSchedules)==null?void 0:T[m])||{}},M=C.name)}const $={format:n,theme:c,language:t,includeSchoolTimes:u},w=m==="master"?await X(o,r,$,n==="pdf"?"pdf":"image"):await Pe(v,{...r,displayName:M},$);if(!w.success)throw new Error(w.error||"Failed to share schedule");V(e("تم فتح قائمة المشاركة بنجاح!","Share dialog opened successfully!","Freigabedialog geöffnet!")),setTimeout(()=>{V(null)},2e3)}catch(v){console.error("[Share School Schedule Error]:",v),N(e("تعذر فتح المشاركة. يرجى المحاولة مرة أخرى أو استخدام خيار الحفظ.","Could not open share dialog. Please try again or download the file.","Freigabe konnte nicht geöffnet werden. Bitte Datei speichern oder erneut versuchen."))}finally{l(!1),x("")}}};return a.jsxDEV("div",{className:"fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-xs animate-fade-in",onClick:s,children:a.jsxDEV("div",{className:"w-full max-w-lg bg-surface border border-surface-border rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-scale-up",onClick:f=>f.stopPropagation(),id:"school-schedule-export-modal",children:[a.jsxDEV("div",{className:"px-3.5 py-2.5 sm:p-4 border-b border-surface-border flex items-center justify-between bg-surface-hover/50",children:[a.jsxDEV("div",{className:"flex items-center gap-2 sm:gap-3 min-w-0",children:[a.jsxDEV("div",{className:"w-8 h-8 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-primary-soft text-primary flex items-center justify-center border border-primary-border shrink-0",children:a.jsxDEV(le,{className:"w-4 h-4 sm:w-5 sm:h-5"},void 0,!1,{fileName:"/app/applet/src/components/SchoolScheduleExportModal.tsx",lineNumber:222,columnNumber:15},void 0)},void 0,!1,{fileName:"/app/applet/src/components/SchoolScheduleExportModal.tsx",lineNumber:221,columnNumber:13},void 0),a.jsxDEV("div",{className:"min-w-0",children:[a.jsxDEV("h2",{className:"text-xs sm:text-base font-black text-text-main leading-tight truncate",children:e("تصدير جدول المدرسة","Export School Schedule","Schulplan exportieren")},void 0,!1,{fileName:"/app/applet/src/components/SchoolScheduleExportModal.tsx",lineNumber:225,columnNumber:15},void 0),a.jsxDEV("p",{className:"text-[10px] sm:text-xs text-text-muted mt-0.5 truncate",children:D.stats.summaryLine},void 0,!1,{fileName:"/app/applet/src/components/SchoolScheduleExportModal.tsx",lineNumber:228,columnNumber:15},void 0)]},void 0,!0,{fileName:"/app/applet/src/components/SchoolScheduleExportModal.tsx",lineNumber:224,columnNumber:13},void 0)]},void 0,!0,{fileName:"/app/applet/src/components/SchoolScheduleExportModal.tsx",lineNumber:220,columnNumber:11},void 0),a.jsxDEV("div",{className:"flex items-center gap-1.5 sm:gap-2 shrink-0",children:a.jsxDEV("button",{onClick:s,disabled:d,className:"p-1 sm:p-1.5 rounded-lg sm:rounded-xl text-text-muted hover:text-text-main hover:bg-surface-border/40 transition-colors cursor-pointer shrink-0",children:a.jsxDEV(De,{className:"w-4 h-4 sm:w-5 sm:h-5"},void 0,!1,{fileName:"/app/applet/src/components/SchoolScheduleExportModal.tsx",lineNumber:239,columnNumber:15},void 0)},void 0,!1,{fileName:"/app/applet/src/components/SchoolScheduleExportModal.tsx",lineNumber:234,columnNumber:13},void 0)},void 0,!1,{fileName:"/app/applet/src/components/SchoolScheduleExportModal.tsx",lineNumber:233,columnNumber:11},void 0)]},void 0,!0,{fileName:"/app/applet/src/components/SchoolScheduleExportModal.tsx",lineNumber:219,columnNumber:9},void 0),a.jsxDEV("div",{className:"p-3.5 sm:p-5 overflow-y-auto space-y-3.5 sm:space-y-4 custom-scrollbar",children:[k&&a.jsxDEV("div",{className:"p-3.5 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-xs font-bold flex items-center gap-2.5 animate-scale-up",children:[a.jsxDEV(je,{className:"w-4 h-4 shrink-0 text-emerald-500"},void 0,!1,{fileName:"/app/applet/src/components/SchoolScheduleExportModal.tsx",lineNumber:249,columnNumber:15},void 0),a.jsxDEV("span",{children:k},void 0,!1,{fileName:"/app/applet/src/components/SchoolScheduleExportModal.tsx",lineNumber:250,columnNumber:15},void 0)]},void 0,!0,{fileName:"/app/applet/src/components/SchoolScheduleExportModal.tsx",lineNumber:248,columnNumber:13},void 0),h&&a.jsxDEV("div",{className:"p-3.5 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 text-xs font-bold flex items-center gap-2.5 animate-scale-up",children:[a.jsxDEV(ke,{className:"w-4 h-4 shrink-0 text-rose-500"},void 0,!1,{fileName:"/app/applet/src/components/SchoolScheduleExportModal.tsx",lineNumber:257,columnNumber:15},void 0),a.jsxDEV("span",{children:h},void 0,!1,{fileName:"/app/applet/src/components/SchoolScheduleExportModal.tsx",lineNumber:258,columnNumber:15},void 0)]},void 0,!0,{fileName:"/app/applet/src/components/SchoolScheduleExportModal.tsx",lineNumber:256,columnNumber:13},void 0),o.teachers&&o.teachers.length>0&&a.jsxDEV("div",{className:"space-y-2.5",children:[a.jsxDEV("label",{className:"text-xs font-black text-text-muted uppercase tracking-wider block",children:e("اختر الجدول للتصدير","Select Schedule to Export","Wählen Sie den zu exportierenden Stundenplan")},void 0,!1,{fileName:"/app/applet/src/components/SchoolScheduleExportModal.tsx",lineNumber:266,columnNumber:15},void 0),a.jsxDEV("select",{value:m,onChange:f=>{E(f.target.value),f.target.value==="master"&&n==="ics"&&p("pdf")},className:"w-full p-3 rounded-2xl border border-surface-border bg-surface text-text-main text-xs font-bold shadow-xs focus:ring-primary focus:border-primary outline-none",children:[a.jsxDEV("option",{value:"my_schedule",children:e("جدولي الخاص","My Own Schedule","Mein eigener Stundenplan")},void 0,!1,{fileName:"/app/applet/src/components/SchoolScheduleExportModal.tsx",lineNumber:279,columnNumber:17},void 0),a.jsxDEV("option",{value:"master",children:e("الجدول الموحد للقسم","Master Unified Matrix","Gesamter Abteilungsplan")},void 0,!1,{fileName:"/app/applet/src/components/SchoolScheduleExportModal.tsx",lineNumber:280,columnNumber:17},void 0),a.jsxDEV("optgroup",{label:e("جداول المعلمين","Teachers","Lehrer"),children:o.teachers.map(f=>a.jsxDEV("option",{value:f.id,children:f.name},f.id,!1,{fileName:"/app/applet/src/components/SchoolScheduleExportModal.tsx",lineNumber:283,columnNumber:21},void 0))},void 0,!1,{fileName:"/app/applet/src/components/SchoolScheduleExportModal.tsx",lineNumber:281,columnNumber:17},void 0)]},void 0,!0,{fileName:"/app/applet/src/components/SchoolScheduleExportModal.tsx",lineNumber:269,columnNumber:15},void 0)]},void 0,!0,{fileName:"/app/applet/src/components/SchoolScheduleExportModal.tsx",lineNumber:265,columnNumber:13},void 0),a.jsxDEV("div",{className:"space-y-2.5",children:[a.jsxDEV("label",{className:"text-xs font-black text-text-muted uppercase tracking-wider block",children:e("صيغة التصدير","Export Format","Exportformat")},void 0,!1,{fileName:"/app/applet/src/components/SchoolScheduleExportModal.tsx",lineNumber:292,columnNumber:13},void 0),a.jsxDEV("div",{className:"grid grid-cols-2 sm:grid-cols-4 gap-2.5",children:[a.jsxDEV("button",{type:"button",onClick:()=>p("ics"),disabled:d||m==="master",className:`p-3 rounded-2xl border text-start flex flex-col justify-between gap-2 transition-all cursor-pointer ${(n==="ics"?"bg-primary-soft border-primary text-primary shadow-xs ":"bg-surface border-surface-border text-text-muted hover:border-surface-border-soft hover:bg-surface-hover ")+(m==="master"?"opacity-40 cursor-not-allowed grayscale":"")}`,children:[a.jsxDEV("div",{className:"flex items-center justify-between",children:[a.jsxDEV(Ce,{className:"w-5 h-5 text-primary"},void 0,!1,{fileName:"/app/applet/src/components/SchoolScheduleExportModal.tsx",lineNumber:309,columnNumber:19},void 0),n==="ics"&&a.jsxDEV("span",{className:"w-2 h-2 rounded-full bg-primary"},void 0,!1,{fileName:"/app/applet/src/components/SchoolScheduleExportModal.tsx",lineNumber:311,columnNumber:21},void 0)]},void 0,!0,{fileName:"/app/applet/src/components/SchoolScheduleExportModal.tsx",lineNumber:308,columnNumber:17},void 0),a.jsxDEV("div",{children:[a.jsxDEV("div",{className:"text-xs font-black text-text-main",children:"iCal (.ics)"},void 0,!1,{fileName:"/app/applet/src/components/SchoolScheduleExportModal.tsx",lineNumber:315,columnNumber:19},void 0),a.jsxDEV("div",{className:"text-[10px] text-text-muted opacity-80 leading-tight mt-0.5",children:e("Google / Apple Calendar","Google / Apple Calendar","Kalendersync")},void 0,!1,{fileName:"/app/applet/src/components/SchoolScheduleExportModal.tsx",lineNumber:318,columnNumber:19},void 0)]},void 0,!0,{fileName:"/app/applet/src/components/SchoolScheduleExportModal.tsx",lineNumber:314,columnNumber:17},void 0)]},void 0,!0,{fileName:"/app/applet/src/components/SchoolScheduleExportModal.tsx",lineNumber:297,columnNumber:15},void 0),a.jsxDEV("button",{type:"button",onClick:()=>p("pdf"),disabled:d,className:`p-3 rounded-2xl border text-start flex flex-col justify-between gap-2 transition-all cursor-pointer ${n==="pdf"?"bg-primary-soft border-primary text-primary shadow-xs":"bg-surface border-surface-border text-text-muted hover:border-surface-border-soft hover:bg-surface-hover"}`,children:[a.jsxDEV("div",{className:"flex items-center justify-between",children:[a.jsxDEV(Ae,{className:"w-5 h-5"},void 0,!1,{fileName:"/app/applet/src/components/SchoolScheduleExportModal.tsx",lineNumber:336,columnNumber:19},void 0),n==="pdf"&&a.jsxDEV("span",{className:"w-2 h-2 rounded-full bg-primary"},void 0,!1,{fileName:"/app/applet/src/components/SchoolScheduleExportModal.tsx",lineNumber:338,columnNumber:21},void 0)]},void 0,!0,{fileName:"/app/applet/src/components/SchoolScheduleExportModal.tsx",lineNumber:335,columnNumber:17},void 0),a.jsxDEV("div",{children:[a.jsxDEV("div",{className:"text-xs font-black text-text-main",children:"PDF (A4)"},void 0,!1,{fileName:"/app/applet/src/components/SchoolScheduleExportModal.tsx",lineNumber:342,columnNumber:19},void 0),a.jsxDEV("div",{className:"text-[10px] text-text-muted opacity-80 leading-tight mt-0.5",children:e("طباعة أفقية Landscape","Landscape Print","Druckoptimiert")},void 0,!1,{fileName:"/app/applet/src/components/SchoolScheduleExportModal.tsx",lineNumber:345,columnNumber:19},void 0)]},void 0,!0,{fileName:"/app/applet/src/components/SchoolScheduleExportModal.tsx",lineNumber:341,columnNumber:17},void 0)]},void 0,!0,{fileName:"/app/applet/src/components/SchoolScheduleExportModal.tsx",lineNumber:325,columnNumber:15},void 0),a.jsxDEV("button",{type:"button",onClick:()=>p("png"),disabled:d,className:`p-3 rounded-2xl border text-start flex flex-col justify-between gap-2 transition-all cursor-pointer ${n==="png"?"bg-primary-soft border-primary text-primary shadow-xs":"bg-surface border-surface-border text-text-muted hover:border-surface-border-soft hover:bg-surface-hover"}`,children:[a.jsxDEV("div",{className:"flex items-center justify-between",children:[a.jsxDEV(ie,{className:"w-5 h-5"},void 0,!1,{fileName:"/app/applet/src/components/SchoolScheduleExportModal.tsx",lineNumber:363,columnNumber:19},void 0),n==="png"&&a.jsxDEV("span",{className:"w-2 h-2 rounded-full bg-primary"},void 0,!1,{fileName:"/app/applet/src/components/SchoolScheduleExportModal.tsx",lineNumber:365,columnNumber:21},void 0)]},void 0,!0,{fileName:"/app/applet/src/components/SchoolScheduleExportModal.tsx",lineNumber:362,columnNumber:17},void 0),a.jsxDEV("div",{children:[a.jsxDEV("div",{className:"text-xs font-black text-text-main",children:"PNG"},void 0,!1,{fileName:"/app/applet/src/components/SchoolScheduleExportModal.tsx",lineNumber:369,columnNumber:19},void 0),a.jsxDEV("div",{className:"text-[10px] text-text-muted opacity-80 leading-tight mt-0.5",children:e("دقة فائقة Retina","Retina High-Res","Ultra-Scharf")},void 0,!1,{fileName:"/app/applet/src/components/SchoolScheduleExportModal.tsx",lineNumber:372,columnNumber:19},void 0)]},void 0,!0,{fileName:"/app/applet/src/components/SchoolScheduleExportModal.tsx",lineNumber:368,columnNumber:17},void 0)]},void 0,!0,{fileName:"/app/applet/src/components/SchoolScheduleExportModal.tsx",lineNumber:352,columnNumber:15},void 0),a.jsxDEV("button",{type:"button",onClick:()=>p("jpeg"),disabled:d,className:`p-3 rounded-2xl border text-start flex flex-col justify-between gap-2 transition-all cursor-pointer ${n==="jpeg"?"bg-primary-soft border-primary text-primary shadow-xs":"bg-surface border-surface-border text-text-muted hover:border-surface-border-soft hover:bg-surface-hover"}`,children:[a.jsxDEV("div",{className:"flex items-center justify-between",children:[a.jsxDEV(ie,{className:"w-5 h-5"},void 0,!1,{fileName:"/app/applet/src/components/SchoolScheduleExportModal.tsx",lineNumber:390,columnNumber:19},void 0),n==="jpeg"&&a.jsxDEV("span",{className:"w-2 h-2 rounded-full bg-primary"},void 0,!1,{fileName:"/app/applet/src/components/SchoolScheduleExportModal.tsx",lineNumber:392,columnNumber:21},void 0)]},void 0,!0,{fileName:"/app/applet/src/components/SchoolScheduleExportModal.tsx",lineNumber:389,columnNumber:17},void 0),a.jsxDEV("div",{children:[a.jsxDEV("div",{className:"text-xs font-black text-text-main",children:"JPG"},void 0,!1,{fileName:"/app/applet/src/components/SchoolScheduleExportModal.tsx",lineNumber:396,columnNumber:19},void 0),a.jsxDEV("div",{className:"text-[10px] text-text-muted opacity-80 leading-tight mt-0.5",children:e("حجم خفيف ومضغوط","Light & Compact","Kompakt")},void 0,!1,{fileName:"/app/applet/src/components/SchoolScheduleExportModal.tsx",lineNumber:399,columnNumber:19},void 0)]},void 0,!0,{fileName:"/app/applet/src/components/SchoolScheduleExportModal.tsx",lineNumber:395,columnNumber:17},void 0)]},void 0,!0,{fileName:"/app/applet/src/components/SchoolScheduleExportModal.tsx",lineNumber:379,columnNumber:15},void 0)]},void 0,!0,{fileName:"/app/applet/src/components/SchoolScheduleExportModal.tsx",lineNumber:295,columnNumber:13},void 0)]},void 0,!0,{fileName:"/app/applet/src/components/SchoolScheduleExportModal.tsx",lineNumber:291,columnNumber:11},void 0),n==="ics"&&a.jsxDEV("div",{className:"p-3.5 rounded-2xl bg-surface-hover border border-surface-border space-y-2",children:[a.jsxDEV("div",{className:"flex items-center justify-between gap-2",children:[a.jsxDEV("div",{className:"flex items-center gap-2 text-xs font-bold text-text-main",children:[a.jsxDEV(Me,{className:"w-4 h-4 text-primary"},void 0,!1,{fileName:"/app/applet/src/components/SchoolScheduleExportModal.tsx",lineNumber:412,columnNumber:19},void 0),a.jsxDEV("span",{children:e("تضمين كتلة الدوام والحضور المدرسي","Include school presence hours","Schulanwesenheitszeiten einbeziehen")},void 0,!1,{fileName:"/app/applet/src/components/SchoolScheduleExportModal.tsx",lineNumber:413,columnNumber:19},void 0)]},void 0,!0,{fileName:"/app/applet/src/components/SchoolScheduleExportModal.tsx",lineNumber:411,columnNumber:17},void 0),a.jsxDEV("input",{type:"checkbox",checked:u,onChange:f=>y(f.target.checked),className:"w-4 h-4 rounded text-primary focus:ring-primary cursor-pointer"},void 0,!1,{fileName:"/app/applet/src/components/SchoolScheduleExportModal.tsx",lineNumber:415,columnNumber:17},void 0)]},void 0,!0,{fileName:"/app/applet/src/components/SchoolScheduleExportModal.tsx",lineNumber:410,columnNumber:15},void 0),a.jsxDEV("p",{className:"text-[11px] text-text-muted",children:e("سيتم إنشاء أحداث أسبوعية متكررة (RRULE) لكل حصة دراسية مع تنبيهات مسبقة قبل كل حصة بـ 15 دقيقة.","Creates recurring weekly events (RRULE) for each period with 15-minute advance alarms in Google Calendar & Apple Calendar.","Erstellt wöchentlich wiederkehrende Termine mit Erinnerungen 15 Minuten vor Beginn.")},void 0,!1,{fileName:"/app/applet/src/components/SchoolScheduleExportModal.tsx",lineNumber:422,columnNumber:15},void 0)]},void 0,!0,{fileName:"/app/applet/src/components/SchoolScheduleExportModal.tsx",lineNumber:409,columnNumber:13},void 0),n!=="ics"&&a.jsxDEV("div",{className:"space-y-2.5",children:[a.jsxDEV("label",{className:"text-xs font-black text-text-muted uppercase tracking-wider block",children:e("مظهر المستند المطبوع","Print & Theme Styling","Erscheinungsbild")},void 0,!1,{fileName:"/app/applet/src/components/SchoolScheduleExportModal.tsx",lineNumber:435,columnNumber:15},void 0),a.jsxDEV("div",{className:"grid grid-cols-2 gap-2.5",children:[a.jsxDEV("button",{type:"button",onClick:()=>i("clean_light"),disabled:d,className:`p-3 rounded-2xl border text-start flex items-center gap-3 transition-all cursor-pointer ${c==="clean_light"?"bg-primary-soft border-primary text-primary shadow-xs":"bg-surface border-surface-border text-text-muted hover:bg-surface-hover"}`,children:[a.jsxDEV(ce,{className:"w-4 h-4 shrink-0"},void 0,!1,{fileName:"/app/applet/src/components/SchoolScheduleExportModal.tsx",lineNumber:449,columnNumber:19},void 0),a.jsxDEV("div",{className:"min-w-0",children:[a.jsxDEV("div",{className:"text-xs font-black text-text-main truncate",children:e("كلاسيكي فاتح (مثالي للطباعة)","Classic Print (Light)","Klassischer Druck (Hell)")},void 0,!1,{fileName:"/app/applet/src/components/SchoolScheduleExportModal.tsx",lineNumber:451,columnNumber:21},void 0),a.jsxDEV("div",{className:"text-[10px] text-text-muted truncate",children:e("خلفية بيضاء وتباين عالي","White canvas, high contrast","Weißer Hintergrund")},void 0,!1,{fileName:"/app/applet/src/components/SchoolScheduleExportModal.tsx",lineNumber:454,columnNumber:21},void 0)]},void 0,!0,{fileName:"/app/applet/src/components/SchoolScheduleExportModal.tsx",lineNumber:450,columnNumber:19},void 0)]},void 0,!0,{fileName:"/app/applet/src/components/SchoolScheduleExportModal.tsx",lineNumber:439,columnNumber:17},void 0),a.jsxDEV("button",{type:"button",onClick:()=>i("brand_accent"),disabled:d,className:`p-3 rounded-2xl border text-start flex items-center gap-3 transition-all cursor-pointer ${c==="brand_accent"?"bg-primary-soft border-primary text-primary shadow-xs":"bg-surface border-surface-border text-text-muted hover:bg-surface-hover"}`,children:[a.jsxDEV($e,{className:"w-4 h-4 shrink-0"},void 0,!1,{fileName:"/app/applet/src/components/SchoolScheduleExportModal.tsx",lineNumber:470,columnNumber:19},void 0),a.jsxDEV("div",{className:"min-w-0",children:[a.jsxDEV("div",{className:"text-xs font-black text-text-main truncate",children:e("ثيم Glück الملون","Glück Accent Theme","Glück Farb-Theme")},void 0,!1,{fileName:"/app/applet/src/components/SchoolScheduleExportModal.tsx",lineNumber:472,columnNumber:21},void 0),a.jsxDEV("div",{className:"text-[10px] text-text-muted truncate",children:e("خلايا ملونة بلمسات التطبيق","App colored badges","Farbige Akzente")},void 0,!1,{fileName:"/app/applet/src/components/SchoolScheduleExportModal.tsx",lineNumber:475,columnNumber:21},void 0)]},void 0,!0,{fileName:"/app/applet/src/components/SchoolScheduleExportModal.tsx",lineNumber:471,columnNumber:19},void 0)]},void 0,!0,{fileName:"/app/applet/src/components/SchoolScheduleExportModal.tsx",lineNumber:460,columnNumber:17},void 0)]},void 0,!0,{fileName:"/app/applet/src/components/SchoolScheduleExportModal.tsx",lineNumber:438,columnNumber:15},void 0)]},void 0,!0,{fileName:"/app/applet/src/components/SchoolScheduleExportModal.tsx",lineNumber:434,columnNumber:13},void 0),a.jsxDEV("div",{className:"p-4 rounded-2xl bg-surface-hover/80 border border-surface-border space-y-3",children:[a.jsxDEV("div",{className:"flex items-center justify-between text-xs font-bold text-text-main",children:[a.jsxDEV("span",{className:"flex items-center gap-1.5",children:[a.jsxDEV(Te,{className:"w-3.5 h-3.5 text-primary"},void 0,!1,{fileName:"/app/applet/src/components/SchoolScheduleExportModal.tsx",lineNumber:488,columnNumber:17},void 0),e("معاينة تفاصيل التصدير","Export Summary Preview","Vorschau-Zusammenfassung")]},void 0,!0,{fileName:"/app/applet/src/components/SchoolScheduleExportModal.tsx",lineNumber:487,columnNumber:15},void 0),a.jsxDEV("span",{className:"text-[11px] text-text-muted",children:[D.days.length," ",e("أيام","Days","Tage")," • ",D.periods.length," ",e("حصص","Periods","Stunden")]},void 0,!0,{fileName:"/app/applet/src/components/SchoolScheduleExportModal.tsx",lineNumber:491,columnNumber:15},void 0)]},void 0,!0,{fileName:"/app/applet/src/components/SchoolScheduleExportModal.tsx",lineNumber:486,columnNumber:13},void 0),a.jsxDEV("div",{className:"p-3 bg-white text-slate-900 rounded-xl border border-slate-200 text-xs space-y-2 shadow-xs",children:[a.jsxDEV("div",{className:"flex items-center justify-between border-b border-slate-100 pb-2",children:[a.jsxDEV("span",{className:"font-black text-slate-900",children:D.title},void 0,!1,{fileName:"/app/applet/src/components/SchoolScheduleExportModal.tsx",lineNumber:498,columnNumber:17},void 0),a.jsxDEV("span",{className:"text-[10px] font-bold text-slate-500",children:D.exportDateFormatted},void 0,!1,{fileName:"/app/applet/src/components/SchoolScheduleExportModal.tsx",lineNumber:499,columnNumber:17},void 0)]},void 0,!0,{fileName:"/app/applet/src/components/SchoolScheduleExportModal.tsx",lineNumber:497,columnNumber:15},void 0),a.jsxDEV("div",{className:"flex items-center justify-between text-[11px] text-slate-600 font-bold",children:[a.jsxDEV("span",{children:D.stats.summaryLine},void 0,!1,{fileName:"/app/applet/src/components/SchoolScheduleExportModal.tsx",lineNumber:502,columnNumber:17},void 0),D.teacherName&&a.jsxDEV("span",{children:D.teacherName},void 0,!1,{fileName:"/app/applet/src/components/SchoolScheduleExportModal.tsx",lineNumber:504,columnNumber:19},void 0)]},void 0,!0,{fileName:"/app/applet/src/components/SchoolScheduleExportModal.tsx",lineNumber:501,columnNumber:15},void 0),a.jsxDEV("div",{className:"text-[10px] text-slate-400 font-medium",children:e("يتم التصدير مباشرة من بيانات الجدول مع دعم كامل للغة العربية والاتجاه من اليمين لليسار بدقة عالية.","Exported programmatically from raw schedule data with full RTL and high resolution vector rendering.","Wird direkt aus den Plandaten im hochauflösenden Format generiert.")},void 0,!1,{fileName:"/app/applet/src/components/SchoolScheduleExportModal.tsx",lineNumber:507,columnNumber:15},void 0)]},void 0,!0,{fileName:"/app/applet/src/components/SchoolScheduleExportModal.tsx",lineNumber:496,columnNumber:13},void 0)]},void 0,!0,{fileName:"/app/applet/src/components/SchoolScheduleExportModal.tsx",lineNumber:485,columnNumber:11},void 0)]},void 0,!0,{fileName:"/app/applet/src/components/SchoolScheduleExportModal.tsx",lineNumber:245,columnNumber:9},void 0),a.jsxDEV("div",{className:"p-4 sm:p-5 border-t border-surface-border bg-surface-hover/30 flex flex-col sm:flex-row items-center gap-2.5",children:[a.jsxDEV("button",{type:"button",onClick:L,disabled:d||n==="ics",className:`w-full sm:w-auto flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-surface border border-surface-border text-text-main hover:bg-surface-hover font-black text-xs transition-all active:scale-95 cursor-pointer shadow-2xs ${n==="ics"?"opacity-40 cursor-not-allowed":""}`,title:e("طباعة فورية للجدول","Print Schedule Directly","Direkt drucken"),children:[a.jsxDEV(ce,{className:"w-4 h-4 text-primary shrink-0"},void 0,!1,{fileName:"/app/applet/src/components/SchoolScheduleExportModal.tsx",lineNumber:528,columnNumber:13},void 0),a.jsxDEV("span",{children:e("طباعة فورية","Print Now","Drucken")},void 0,!1,{fileName:"/app/applet/src/components/SchoolScheduleExportModal.tsx",lineNumber:529,columnNumber:13},void 0)]},void 0,!0,{fileName:"/app/applet/src/components/SchoolScheduleExportModal.tsx",lineNumber:521,columnNumber:11},void 0),a.jsxDEV("button",{type:"button",onClick:U,disabled:d,className:"w-full sm:flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-surface border border-surface-border text-text-main hover:bg-surface-hover font-bold text-xs transition-all active:scale-95 cursor-pointer shadow-2xs",children:[d?a.jsxDEV(de,{className:"w-4 h-4 animate-spin text-primary shrink-0"},void 0,!1,{fileName:"/app/applet/src/components/SchoolScheduleExportModal.tsx",lineNumber:540,columnNumber:15},void 0):a.jsxDEV(Ve,{className:"w-4 h-4 text-primary shrink-0"},void 0,!1,{fileName:"/app/applet/src/components/SchoolScheduleExportModal.tsx",lineNumber:542,columnNumber:15},void 0),a.jsxDEV("span",{children:e("مشاركة","Share","Teilen")},void 0,!1,{fileName:"/app/applet/src/components/SchoolScheduleExportModal.tsx",lineNumber:544,columnNumber:13},void 0)]},void 0,!0,{fileName:"/app/applet/src/components/SchoolScheduleExportModal.tsx",lineNumber:533,columnNumber:11},void 0),a.jsxDEV("button",{type:"button",onClick:A,disabled:d,className:"w-full sm:flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-primary hover:bg-primary-hover text-white font-black text-xs transition-all active:scale-95 cursor-pointer shadow-sm",children:d?a.jsxDEV(a.Fragment,{children:[a.jsxDEV(de,{className:"w-4 h-4 animate-spin shrink-0"},void 0,!1,{fileName:"/app/applet/src/components/SchoolScheduleExportModal.tsx",lineNumber:556,columnNumber:17},void 0),a.jsxDEV("span",{className:"truncate",children:b||e("جاري التصدير...","Exporting...","Wird exportiert...")},void 0,!1,{fileName:"/app/applet/src/components/SchoolScheduleExportModal.tsx",lineNumber:557,columnNumber:17},void 0)]},void 0,!0,{fileName:"/app/applet/src/components/SchoolScheduleExportModal.tsx",lineNumber:555,columnNumber:15},void 0):a.jsxDEV(a.Fragment,{children:[a.jsxDEV(le,{className:"w-4 h-4 shrink-0"},void 0,!1,{fileName:"/app/applet/src/components/SchoolScheduleExportModal.tsx",lineNumber:561,columnNumber:17},void 0),a.jsxDEV("span",{className:"truncate",children:n==="ics"?e("حفظ التقويم (.ics)","Save Calendar (.ics)","Speichern (.ics)"):n==="pdf"?e("حفظ PDF","Save PDF","PDF speichern"):e("حفظ الصورة","Save Image","Bild speichern")},void 0,!1,{fileName:"/app/applet/src/components/SchoolScheduleExportModal.tsx",lineNumber:562,columnNumber:17},void 0)]},void 0,!0,{fileName:"/app/applet/src/components/SchoolScheduleExportModal.tsx",lineNumber:560,columnNumber:15},void 0)},void 0,!1,{fileName:"/app/applet/src/components/SchoolScheduleExportModal.tsx",lineNumber:548,columnNumber:11},void 0)]},void 0,!0,{fileName:"/app/applet/src/components/SchoolScheduleExportModal.tsx",lineNumber:519,columnNumber:9},void 0)]},void 0,!0,{fileName:"/app/applet/src/components/SchoolScheduleExportModal.tsx",lineNumber:213,columnNumber:7},void 0)},void 0,!1,{fileName:"/app/applet/src/components/SchoolScheduleExportModal.tsx",lineNumber:209,columnNumber:5},void 0)},W={أ:"A",ا:"A",ب:"B",ج:"C",د:"D",هـ:"E",ه:"E",و:"F",ز:"G",ح:"H",ط:"I",ي:"J",ك:"K",ل:"L",م:"M",ن:"N"};function Re(s){return s?s.replace(/[٠-٩]/g,r=>String("٠١٢٣٤٥٦٧٨٩".indexOf(r))):""}function ze(s,r){if(!s)return r?`${r}A`:"10A";let e=Re(String(s)).trim();e=e.replace(/^(?:الفصل|فصل|مجموعة|صف|الصف|سنة|قاعة|class|section|room|sec|grade|g)\s*[:\-\/]?\s*/i,"").trim();const t=e.match(/^(\d{1,2})\s*[\-_/.\s]*([a-zA-Z\u0621-\u064A])$/i);if(t){const h=t[1];let N=t[2].toUpperCase();return W[N]&&(N=W[N]),`${h}${N}`}const o=e.match(/(\d{1,2})\s*[\-_/.\s]*([a-zA-Z\u0621-\u064A])\b/i);if(o){const h=o[1];let N=o[2].toUpperCase();return W[N]&&(N=W[N]),`${h}${N}`}const n=/(?:first|1st|1|الأول|أولى)\s+(?:secondary|sec|ثانوي|ثانوية)/i.test(e),p=/(?:second|2nd|2|الثاني|ثانية)\s+(?:secondary|sec|ثانوي|ثانوية)/i.test(e),c=/(?:third|3rd|3|الثالث|ثالثة)\s+(?:secondary|sec|ثانوي|ثانوية)/i.test(e),i=/(?:first|1st|1|الأول|أولى)\s+(?:prep|preparatory|إعدادي|اعدادي|إعدادية)/i.test(e),u=/(?:second|2nd|2|الثاني|ثانية)\s+(?:prep|preparatory|إعدادي|اعدادي|إعدادية)/i.test(e),y=/(?:third|3rd|3|الثالث|ثالثة)\s+(?:prep|preparatory|إعدادي|اعدادي|إعدادية)/i.test(e),d=e.match(/([a-zA-Z\u0621-\u064A])(?:[\s\-_]*)$/i)||e.match(/\b([A-Fa-f\u0621-\u064A])\b/i);let l="A";if(d){let h=d[1].toUpperCase();l=W[h]||h}const b=e.match(/\b(\d{1,2})\b/);if(b)return`${b[1]}${l}`;if(n)return`10${l}`;if(p)return`11${l}`;if(c)return`12${l}`;if(i)return`7${l}`;if(u)return`8${l}`;if(y)return`9${l}`;if(/kg\s*1/i.test(e)||/كي\s*جي\s*1/i.test(e))return`KG1${l}`;if(/kg\s*2/i.test(e)||/كي\s*جي\s*2/i.test(e))return`KG2${l}`;if(/^[A-Za-z\u0621-\u064A]$/.test(e)&&r){const h=W[e.toUpperCase()]||e.toUpperCase();return`${r}${h}`}const x=e.replace(/[\s\-_/.]+/g,"").toUpperCase();return/^\d+[A-Z]$/.test(x)?x:/^\d+$/.test(x)?`${x}A`:x||(r?`${r}A`:"10A")}function We(s){if(!s)return"";const r=ze(s),e=r.match(/^(\d+)/);if(e)return e[1];const t=r.match(/^(KG\d)/i);if(t)return t[1].toUpperCase();const o=r.match(/\d+/);return o?o[0]:r}function He(s,r){if(!s&&!r)return 0;if(!s)return 1;if(!r)return-1;const e=parseInt(s.replace(/\D/g,""),10),t=parseInt(r.replace(/\D/g,""),10);return!isNaN(e)&&!isNaN(t)&&e!==t?e-t:s.localeCompare(r,void 0,{numeric:!0,sensitivity:"base"})}const q=`قواعد إلزامية ومشددة لتوحيد أسماء الفصول (STRICT CLASS CODE STANDARD):
- يجب أن يُكتب اسم الفصل دائماً بالصيغة الموحدة: [رقم الصف][حرف الفصل الإنجليزي الكبير] بدون أي مسافات وبدون شرطات (مثال: 10A, 10B, 11A, 11B, 7A, 7B, 1A, 2B, 3C).
- تحويل فوري للحروف العربية إلى المقابل الإنجليزي:
  * (أ / ا -> A) | (ب -> B) | (ج -> C) | (د -> D) | (هـ / ه -> E) | (و -> F) | (ز -> G) | (ح -> H).
- تحويل المراحل الدراسية والأسماء الوصفية إلى رقم الصف القياسي:
  * المرحلة الثانوية (Secondary):
    - أولى ثانوي (First Secondary / 1st Sec) -> الصف 10 (مثال: أولى ثانوي أ = 10A، أولى ثانوي ب = 10B)
    - ثانية ثانوي (Second Secondary / 2nd Sec) -> الصف 11 (مثال: ثانية ثانوي أ = 11A، ثانية ثانوي ب = 11B)
    - ثالثة ثانوي (Third Secondary / 3rd Sec) -> الصف 12 (مثال: ثالثة ثانوي أ = 12A، ثالثة ثانوي ب = 12B)
  * المرحلة الإعدادية (Preparatory / Middle):
    - أولى إعدادي (1st Prep) -> الصف 7 (مثال: أولى إعدادي أ أو 1 = 7A)
    - ثانية إعدادي (2nd Prep) -> الصف 8 (مثال: ثانية إعدادي ب أو 2 = 8B)
    - ثالثة إعدادي (3rd Prep) -> الصف 9 (مثال: ثالثة إعدادي ج أو 3 = 9C)
  * المرحلة الابتدائية (Primary): الصفوف من 1 إلى 6 (مثال: 1A, 2B, 3A, 4B, 5A, 6B).
- ممنوع منعاً باتاً:
  * لا تكتب: "10-A" أو "10 A" أو "Class 10A" أو "Grade 10A" أو "فصل 10 أ" أو "10/1" أو "أولى ثانوي أ".
  * اكتب فقط الرمز القياسي الصافي مثل: "10A".`,ue=`CRITICAL MANDATORY CLASS CODE STANDARDIZATION:
- Class codes MUST strictly be formatted as [Grade Number][Section Letter] with NO spaces, NO dashes, and UPPERCASE letter.
- Examples of the required standard:
  * Primary (Grades 1-6): 1A, 1B, 2A, 2B, 3A, 4A, 5A, 6B
  * Preparatory / Middle (Grades 7-9):
    - 1st Prep -> Grade 7 (7A, 7B, 7C...)
    - 2nd Prep -> Grade 8 (8A, 8B, 8C...)
    - 3rd Prep -> Grade 9 (9A, 9B, 9C...)
  * Secondary / High School (Grades 10-12):
    - 1st Secondary -> Grade 10 (10A, 10B, 10C...)
    - 2nd Secondary -> Grade 11 (11A, 11B, 11C...)
    - 3rd Secondary -> Grade 12 (12A, 12B, 12C...)
- Arabic Section Letters Conversion: (أ/ا -> A, ب -> B, ج -> C, د -> D, هـ -> E, و -> F).
- Strictly FORBIDDEN: Do NOT output "10-A", "Class 10A", "Grade 10 A", "10/1", or "FIRST SECONDARY 10A". Output ONLY "10A".`;function Je(s,r,e="ar"){const t=r||"10A";return e==="ar"?`أنت مساعد خبير وفائق الدقة في استخراج وتنظيم بيانات الطلاب المدرسية للغة الألمانية كلغة ثانية.
قم بتحليل المستند / كشف الأسماء أو الصورة المرفقة بعناية فائقة واستخرج الطلاب وفق الشروط الصارمة التالية:

1. الطلاب المستهدفون (طلاب الألماني فقط):
   - استخرج فقط الطلاب الذين يدرسون اللغة الألمانية كلغة ثانية (Deutsch / ألماني).
   - استبعد وتجاهل تماماً أي طلاب يدرسون لغات أخرى مثل الفرنسي (Français) أو الإيطالي (Italiano).

2. ${q}
   ${r?`* الفصل المستهدف المحدد لهذا الكشف هو: "${r}"`:s?`* الصف المستهدف المحدد لهذا الكشف هو: "${s}"`:""}

3. صيغة الإخراج المطلوبة (JSON صافي فقط):
   أخرج مصفوفة JSON صافية فقط بدون أي نصوص قبلها أو بعدها أو شروحات:
[
  {
    "nameAr": "اسم الطالب باللغة العربية كامل ثلاثي أو رباعي",
    "nameEn": "Student Full Name in English",
    "gender": "Boy" أو "Girl",
    "gradeClass": "${t}",
    "busLine": "رقم الخط أو اسم الباص أو N/A"
  }
]

يرجى معالجة جميع طلاب الألماني في الكشف وإخراج مصفوفة الـ JSON النظيفة فوراً.`:e==="en"?`You are an expert school data extraction assistant for German language departments. Analyze this class roster image/document carefully.

CRITICAL EXTRACTION RULES:
1. TARGET STUDENTS ONLY:
   - Extract ONLY students studying German as a 2nd foreign language (Deutsch / ألماني).
   - COMPLETELY IGNORE / EXCLUDE French (Français / فرنسي) and Italian students.

2. ${ue}
   ${r?`* The specific class for this roster is: "${r}"`:s?`* The specific grade for this roster is: "${s}"`:""}

3. REQUIRED JSON OUTPUT FORMAT:
   Return ONLY a raw, valid JSON array of student objects (no markdown wrapping, no conversational explanation):
[
  {
    "nameAr": "اسم الطالب باللغة العربية كامل رباعي أو ثلاثي",
    "nameEn": "Student Full Name in English",
    "gender": "Boy" or "Girl",
    "gradeClass": "${t}",
    "busLine": "Line Number / Bus Line name or N/A"
  }
]

Please process all valid German students in the roster and output the clean JSON array.`:`أنت مساعد خبير لاستخراج بيانات الطلاب المدرسية / You are an expert school data extraction assistant.

قواعد الاستخراج الإلزامية (Mandatory Extraction Rules):
1. استخراج طلاب اللغة الألمانية فقط (Deutsch students only) - استبعاد الفرنسي والإيطالي.
2. ${q}
3. ${ue}
   ${r?`* الفصل المستهدف (Target Class): "${r}"`:s?`* المرحلة المستهدفة (Target Grade): "${s}"`:""}

صيغة الإخراج (Output JSON Schema Only):
[
  {
    "nameAr": "اسم الطالب باللغة العربية",
    "nameEn": "Student English Name",
    "gender": "Boy" / "Girl",
    "gradeClass": "${t}",
    "busLine": "Line 01 / N/A"
  }
]`}function Ke(s){const{scope:r,teacherName:e,teachersList:t,lang:o="ar"}=s;return r==="single"?`أنا أقوم ببناء جدول حصص مدرسي رقمي متكامل. يرجى استخراج جدول الحصص الأسبوعي الخاص بالمعلم/ة "${e||"المعلم"}" من النص أو الصورة المرفقة.

الناتج يجب أن يكون بتنسيق JSON فقط (بدون أي شروحات أو نصوص إضافية) ويطابق الـ Schema التالي تماماً:
\`\`\`json
{
  "schedule": {
    "0": [{ "periodNumber": 1, "className": "10A", "subjectName": "Deutsch" }],
    "1": [],
    "2": [],
    "3": [],
    "4": []
  }
}
\`\`\`

ملاحظات وقواعد إلزامية حاسمة:
1. المفاتيح من "0" إلى "4" تمثل أيام الأسبوع:
   (0 = الأحد / Sunday، 1 = الإثنين / Monday، 2 = الثلاثاء / Tuesday، 3 = الأربعاء / Wednesday، 4 = الخميس / Thursday).
2. ${q}
3. subjectName هو اسم المادة (يرجى توحيده لـ "Deutsch" لمادة اللغة الألمانية).
4. periodNumber هو رقم الحصة (1، 2، 3، 4...).
5. ⚠️ احتساب الفسحة / البريك (Break):
   - الفسحة تُحسب دائماً حصة واحدة فقط لا غير (Exactly 1 period slot)، ولا تأخذ أكثر من حصة واحدة أبداً.
   - يجب احتساب الفسحة ضمن الترقيم التسلسلي للحصص (periodNumber) كحصة مفردة (مثال: إذا كانت الفسحة بعد الحصة 3، تُعد الفسحة هي الحصة رقم 4 كحصة واحدة فقط، وتكون الحصة التي تليها مباشرة هي الحصة رقم 5) لضمان دقة التوقيت وعدم حدوث أي ترحيل في أرقام الحصص التالية.
6. لا تقم باختراع أي بيانات غير موجودة في الجدول المرفق.
أخرج JSON صالح ونظيف فقط.`:`أنا أقوم ببناء جدول حصص مدرسي رقمي لعدة معلمين في قسم اللغة الألمانية. يرجى استخراج جدول الحصص الأسبوعي من النص أو الصورة المرفقة.

قائمة المعلمين المتاحين في النظام (يجب استخدام نفس هذه الأسماء بدقة):
${t&&t.length>0?t.join("، "):"المعلمين المسجلين في القسم"}

الناتج يجب أن يكون بتنسيق JSON فقط (بدون أي نصوص إضافية أو شروحات) ويطابق الـ Schema التالي تماماً:
\`\`\`json
{
  "teachersSchedules": {
    "اسم المعلم 1": {
      "0": [{ "periodNumber": 1, "className": "10A", "subjectName": "Deutsch" }],
      "1": [{ "periodNumber": 2, "className": "11B", "subjectName": "Deutsch" }],
      "2": [],
      "3": [],
      "4": []
    },
    "اسم المعلم 2": {
      "0": [{ "periodNumber": 3, "className": "7A", "subjectName": "Deutsch" }]
    }
  }
}
\`\`\`

ملاحظات وقواعد إلزامية حاسمة:
1. المفاتيح من "0" إلى "4" تمثل أيام الأسبوع:
   (0 = الأحد، 1 = الإثنين، 2 = الثلاثاء، 3 = الأربعاء، 4 = الخميس).
2. ${q}
3. className هو اسم الفصل ويجب أن يكون موحداً بدقة (مثل 10A, 11B, 7A...) ليتطابق مع فصول الطلاب المسجلين.
4. subjectName هو اسم المادة (يرجى توحيده لـ "Deutsch").
5. periodNumber هو رقم الحصة (1، 2، 3...).
6. ⚠️ احتساب الفسحة / البريك (Break):
   - الفسحة تُحسب دائماً حصة واحدة فقط لا غير (Exactly 1 period slot)، ولا تأخذ أكثر من حصة واحدة أبداً.
   - يجب احتساب الفسحة ضمن الترقيم التسلسلي للحصص (periodNumber) كحصة مفردة (مثال: إذا كانت الفسحة بعد الحصة 3، تُعد الفسحة هي الحصة رقم 4 كحصة واحدة فقط، وتكون الحصة التي تليها مباشرة هي الحصة رقم 5) لضمان دقة التوقيت وعدم حدوث أي ترحيل في أرقام الحصص التالية.
7. لا تقم باختراع أي بيانات غير موجودة.
أخرج كود JSON الصالح والنظيف فقط.`}export{q as C,_e as S,Ke as a,He as c,We as e,Je as g,ze as n};
