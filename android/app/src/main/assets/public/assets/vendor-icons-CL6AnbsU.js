import{g as D1}from"./vendor-capacitor-storage-D5SWkiJ2.js";function U1(l,c){for(var f=0;f<c.length;f++){const k=c[f];if(typeof k!="string"&&!Array.isArray(k)){for(const _ in k)if(_!=="default"&&!(_ in l)){const p=Object.getOwnPropertyDescriptor(k,_);p&&Object.defineProperty(l,_,p.get?p:{enumerable:!0,get:()=>k[_]})}}}return Object.freeze(Object.defineProperty(l,Symbol.toStringTag,{value:"Module"}))}var X={exports:{}},E={exports:{}};E.exports;var N1;function Y1(){return N1||(N1=1,(function(l,c){/**
 * @license React
 * react.development.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */(function(){function f(e,a){Object.defineProperty(p.prototype,e,{get:function(){console.warn("%s(...) is deprecated in plain JavaScript React classes. %s",a[0],a[1])}})}function k(e){return e===null||typeof e!="object"?null:(e=y1&&e[y1]||e["@@iterator"],typeof e=="function"?e:null)}function _(e,a){e=(e=e.constructor)&&(e.displayName||e.name)||"ReactClass";var o=e+"."+a;l1[o]||(console.error("Can't call %s on a component that is not yet mounted. This is a no-op, but it might indicate a bug in your application. Instead, assign to `this.state` directly or define a `state = {};` class property with the desired state in the %s component.",a,e),l1[o]=!0)}function p(e,a,o){this.props=e,this.context=a,this.refs=Q,this.updater=o||u1}function q(){}function g(e,a,o){this.props=e,this.context=a,this.refs=Q,this.updater=o||u1}function $(){}function j(e){return""+e}function w(e){try{j(e);var a=!1}catch{a=!0}if(a){a=console;var o=a.error,n=typeof Symbol=="function"&&Symbol.toStringTag&&e[Symbol.toStringTag]||e.constructor.name||"Object";return o.call(a,"The provided key is an unsupported type %s. This value must be coerced to a string before using it here.",n),j(e)}}function R(e){if(e==null)return null;if(typeof e=="function")return e.$$typeof===O1?null:e.displayName||e.name||null;if(typeof e=="string")return e;switch(e){case B:return"Fragment";case r1:return"Profiler";case c1:return"StrictMode";case h1:return"Suspense";case S1:return"SuspenseList";case d1:return"Activity"}if(typeof e=="object")switch(typeof e.tag=="number"&&console.error("Received an unexpected object in getComponentNameFromType(). This is likely a bug in React. Please file an issue."),e.$$typeof){case n1:return"Portal";case s1:return e.displayName||"Context";case F:return(e._context.displayName||"Context")+".Consumer";case i1:var a=e.render;return e=e.displayName,e||(e=a.displayName||a.name||"",e=e!==""?"ForwardRef("+e+")":"ForwardRef"),e;case G:return a=e.displayName||null,a!==null?a:R(e.type)||"Memo";case C:a=e._payload,e=e._init;try{return R(e(a))}catch{}}return null}function Z(e){if(e===B)return"<>";if(typeof e=="object"&&e!==null&&e.$$typeof===C)return"<...>";try{var a=R(e);return a?"<"+a+">":"<...>"}catch{return"<...>"}}function J(){var e=i.A;return e===null?null:e.getOwner()}function e1(){return Error("react-stack-top-frame")}function t1(e){if(H.call(e,"key")){var a=Object.getOwnPropertyDescriptor(e,"key").get;if(a&&a.isReactWarning)return!1}return e.key!==void 0}function z1(e,a){function o(){_1||(_1=!0,console.error("%s: `key` is not a prop. Trying to access it will result in `undefined` being returned. If you need to access the same value within the child component, you should pass it as a different prop. (https://react.dev/link/special-props)",a))}o.isReactWarning=!0,Object.defineProperty(e,"key",{get:o,configurable:!0})}function E1(){var e=R(this.type);return m1[e]||(m1[e]=!0,console.error("Accessing element.ref was removed in React 19. ref is now a regular prop. It will be removed from the JSX Element type in a future release.")),e=this.props.ref,e!==void 0?e:null}function D(e,a,o,n,r,h){var s=o.ref;return e={$$typeof:I,type:e,key:a,props:o,_owner:n},(s!==void 0?s:null)!==null?Object.defineProperty(e,"ref",{enumerable:!1,get:E1}):Object.defineProperty(e,"ref",{enumerable:!1,value:null}),e._store={},Object.defineProperty(e._store,"validated",{configurable:!1,enumerable:!1,writable:!0,value:0}),Object.defineProperty(e,"_debugInfo",{configurable:!1,enumerable:!1,writable:!0,value:null}),Object.defineProperty(e,"_debugStack",{configurable:!1,enumerable:!1,writable:!0,value:r}),Object.defineProperty(e,"_debugTask",{configurable:!1,enumerable:!1,writable:!0,value:h}),Object.freeze&&(Object.freeze(e.props),Object.freeze(e)),e}function q1(e,a){return a=D(e.type,a,e.props,e._owner,e._debugStack,e._debugTask),e._store&&(a._store.validated=e._store.validated),a}function a1(e){b(e)?e._store&&(e._store.validated=1):typeof e=="object"&&e!==null&&e.$$typeof===C&&(e._payload.status==="fulfilled"?b(e._payload.value)&&e._payload.value._store&&(e._payload.value._store.validated=1):e._store&&(e._store.validated=1))}function b(e){return typeof e=="object"&&e!==null&&e.$$typeof===I}function j1(e){var a={"=":"=0",":":"=2"};return"$"+e.replace(/[=:]/g,function(o){return a[o]})}function U(e,a){return typeof e=="object"&&e!==null&&e.key!=null?(w(e.key),j1(""+e.key)):a.toString(36)}function R1(e){switch(e.status){case"fulfilled":return e.value;case"rejected":throw e.reason;default:switch(typeof e.status=="string"?e.then($,$):(e.status="pending",e.then(function(a){e.status==="pending"&&(e.status="fulfilled",e.value=a)},function(a){e.status==="pending"&&(e.status="rejected",e.reason=a)})),e.status){case"fulfilled":return e.value;case"rejected":throw e.reason}}throw e}function x(e,a,o,n,r){var h=typeof e;(h==="undefined"||h==="boolean")&&(e=null);var s=!1;if(e===null)s=!0;else switch(h){case"bigint":case"string":case"number":s=!0;break;case"object":switch(e.$$typeof){case I:case n1:s=!0;break;case C:return s=e._init,x(s(e._payload),a,o,n,r)}}if(s){s=e,r=r(s);var y=n===""?"."+U(s,0):n;return k1(r)?(o="",y!=null&&(o=y.replace(g1,"$&/")+"/"),x(r,a,o,"",function(m){return m})):r!=null&&(b(r)&&(r.key!=null&&(s&&s.key===r.key||w(r.key)),o=q1(r,o+(r.key==null||s&&s.key===r.key?"":(""+r.key).replace(g1,"$&/")+"/")+y),n!==""&&s!=null&&b(s)&&s.key==null&&s._store&&!s._store.validated&&(o._store.validated=2),r=o),a.push(r)),1}if(s=0,y=n===""?".":n+":",k1(e))for(var d=0;d<e.length;d++)n=e[d],h=y+U(n,d),s+=x(n,a,o,h,r);else if(d=k(e),typeof d=="function")for(d===e.entries&&(M1||console.warn("Using Maps as children is not supported. Use an array of keyed ReactElements instead."),M1=!0),e=d.call(e),d=0;!(n=e.next()).done;)n=n.value,h=y+U(n,d++),s+=x(n,a,o,h,r);else if(h==="object"){if(typeof e.then=="function")return x(R1(e),a,o,n,r);throw a=String(e),Error("Objects are not valid as a React child (found: "+(a==="[object Object]"?"object with keys {"+Object.keys(e).join(", ")+"}":a)+"). If you meant to render a collection of children, use an array instead.")}return s}function T(e,a,o){if(e==null)return e;var n=[],r=0;return x(e,n,"","",function(h){return a.call(o,h,r++)}),n}function T1(e){if(e._status===-1){var a=e._ioInfo;a!=null&&(a.start=a.end=performance.now()),a=e._result;var o=a();if(o.then(function(r){if(e._status===0||e._status===-1){e._status=1,e._result=r;var h=e._ioInfo;h!=null&&(h.end=performance.now()),o.status===void 0&&(o.status="fulfilled",o.value=r)}},function(r){if(e._status===0||e._status===-1){e._status=2,e._result=r;var h=e._ioInfo;h!=null&&(h.end=performance.now()),o.status===void 0&&(o.status="rejected",o.reason=r)}}),a=e._ioInfo,a!=null){a.value=o;var n=o.displayName;typeof n=="string"&&(a.name=n)}e._status===-1&&(e._status=0,e._result=o)}if(e._status===1)return a=e._result,a===void 0&&console.error(`lazy: Expected the result of a dynamic import() call. Instead received: %s

Your code should look like: 
  const MyComponent = lazy(() => import('./MyComponent'))

Did you accidentally put curly braces around the import?`,a),"default"in a||console.error(`lazy: Expected the result of a dynamic import() call. Instead received: %s

Your code should look like: 
  const MyComponent = lazy(() => import('./MyComponent'))`,a),a.default;throw e._result}function u(){var e=i.H;return e===null&&console.error(`Invalid hook call. Hooks can only be called inside of the body of a function component. This could happen for one of the following reasons:
1. You might have mismatching versions of React and the renderer (such as React DOM)
2. You might be breaking the Rules of Hooks
3. You might have more than one copy of React in the same app
See https://react.dev/link/invalid-hook-call for tips about how to debug and fix this problem.`),e}function o1(){i.asyncTransitions--}function S(e){if(L===null)try{var a=("require"+Math.random()).slice(0,7);L=(l&&l[a]).call(l,"timers").setImmediate}catch{L=function(n){b1===!1&&(b1=!0,typeof MessageChannel>"u"&&console.error("This browser does not have a MessageChannel implementation, so enqueuing tasks via await act(async () => ...) will fail. Please file an issue at https://github.com/facebook/react/issues if you encounter this warning."));var r=new MessageChannel;r.port1.onmessage=n,r.port2.postMessage(void 0)}}return L(e)}function A(e){return 1<e.length&&typeof AggregateError=="function"?new AggregateError(e):e[0]}function O(e,a){a!==V-1&&console.error("You seem to have overlapping act() calls, this is not supported. Be sure to await previous act() calls before making a new one. "),V=a}function Y(e,a,o){var n=i.actQueue;if(n!==null)if(n.length!==0)try{W(n),S(function(){return Y(e,a,o)});return}catch(r){i.thrownErrors.push(r)}else i.actQueue=null;0<i.thrownErrors.length?(n=A(i.thrownErrors),i.thrownErrors.length=0,o(n)):a(e)}function W(e){if(!K){K=!0;var a=0;try{for(;a<e.length;a++){var o=e[a];do{i.didUsePromise=!1;var n=o(!1);if(n!==null){if(i.didUsePromise){e[a]=o,e.splice(0,a);return}o=n}else break}while(!0)}e.length=0}catch(r){e.splice(0,a+1),i.thrownErrors.push(r)}finally{K=!1}}}typeof __REACT_DEVTOOLS_GLOBAL_HOOK__<"u"&&typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStart=="function"&&__REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStart(Error());var I=Symbol.for("react.transitional.element"),n1=Symbol.for("react.portal"),B=Symbol.for("react.fragment"),c1=Symbol.for("react.strict_mode"),r1=Symbol.for("react.profiler"),F=Symbol.for("react.consumer"),s1=Symbol.for("react.context"),i1=Symbol.for("react.forward_ref"),h1=Symbol.for("react.suspense"),S1=Symbol.for("react.suspense_list"),G=Symbol.for("react.memo"),C=Symbol.for("react.lazy"),d1=Symbol.for("react.activity"),y1=Symbol.iterator,l1={},u1={isMounted:function(){return!1},enqueueForceUpdate:function(e){_(e,"forceUpdate")},enqueueReplaceState:function(e){_(e,"replaceState")},enqueueSetState:function(e){_(e,"setState")}},p1=Object.assign,Q={};Object.freeze(Q),p.prototype.isReactComponent={},p.prototype.setState=function(e,a){if(typeof e!="object"&&typeof e!="function"&&e!=null)throw Error("takes an object of state variables to update or a function which returns an object of state variables.");this.updater.enqueueSetState(this,e,a,"setState")},p.prototype.forceUpdate=function(e){this.updater.enqueueForceUpdate(this,e,"forceUpdate")};var v={isMounted:["isMounted","Instead, make sure to clean up subscriptions and pending requests in componentWillUnmount to prevent memory leaks."],replaceState:["replaceState","Refactor your code to use setState instead (see https://github.com/facebook/react/issues/3236)."]};for(z in v)v.hasOwnProperty(z)&&f(z,v[z]);q.prototype=p.prototype,v=g.prototype=new q,v.constructor=g,p1(v,p.prototype),v.isPureReactComponent=!0;var k1=Array.isArray,O1=Symbol.for("react.client.reference"),i={H:null,A:null,T:null,S:null,actQueue:null,asyncTransitions:0,isBatchingLegacy:!1,didScheduleLegacyUpdate:!1,didUsePromise:!1,thrownErrors:[],getCurrentStack:null,recentlyCreatedOwnerStacks:0},H=Object.prototype.hasOwnProperty,f1=console.createTask?console.createTask:function(){return null};v={react_stack_bottom_frame:function(e){return e()}};var _1,v1,m1={},H1=v.react_stack_bottom_frame.bind(v,e1)(),L1=f1(Z(e1)),M1=!1,g1=/\/+/g,w1=typeof reportError=="function"?reportError:function(e){if(typeof window=="object"&&typeof window.ErrorEvent=="function"){var a=new window.ErrorEvent("error",{bubbles:!0,cancelable:!0,message:typeof e=="object"&&e!==null&&typeof e.message=="string"?String(e.message):String(e),error:e});if(!window.dispatchEvent(a))return}else if(typeof process=="object"&&typeof process.emit=="function"){process.emit("uncaughtException",e);return}console.error(e)},b1=!1,L=null,V=0,P=!1,K=!1,x1=typeof queueMicrotask=="function"?function(e){queueMicrotask(function(){return queueMicrotask(e)})}:S;v=Object.freeze({__proto__:null,c:function(e){return u().useMemoCache(e)}});var z={map:T,forEach:function(e,a,o){T(e,function(){a.apply(this,arguments)},o)},count:function(e){var a=0;return T(e,function(){a++}),a},toArray:function(e){return T(e,function(a){return a})||[]},only:function(e){if(!b(e))throw Error("React.Children.only expected to receive a single React element child.");return e}};c.Activity=d1,c.Children=z,c.Component=p,c.Fragment=B,c.Profiler=r1,c.PureComponent=g,c.StrictMode=c1,c.Suspense=h1,c.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE=i,c.__COMPILER_RUNTIME=v,c.act=function(e){var a=i.actQueue,o=V;V++;var n=i.actQueue=a!==null?a:[],r=!1;try{var h=e()}catch(d){i.thrownErrors.push(d)}if(0<i.thrownErrors.length)throw O(a,o),e=A(i.thrownErrors),i.thrownErrors.length=0,e;if(h!==null&&typeof h=="object"&&typeof h.then=="function"){var s=h;return x1(function(){r||P||(P=!0,console.error("You called act(async () => ...) without await. This could lead to unexpected testing behaviour, interleaving multiple act calls and mixing their scopes. You should - await act(async () => ...);"))}),{then:function(d,m){r=!0,s.then(function(N){if(O(a,o),o===0){try{W(n),S(function(){return Y(N,d,m)})}catch(P1){i.thrownErrors.push(P1)}if(0<i.thrownErrors.length){var V1=A(i.thrownErrors);i.thrownErrors.length=0,m(V1)}}else d(N)},function(N){O(a,o),0<i.thrownErrors.length&&(N=A(i.thrownErrors),i.thrownErrors.length=0),m(N)})}}}var y=h;if(O(a,o),o===0&&(W(n),n.length!==0&&x1(function(){r||P||(P=!0,console.error("A component suspended inside an `act` scope, but the `act` call was not awaited. When testing React components that depend on asynchronous data, you must await the result:\n\nawait act(() => ...)"))}),i.actQueue=null),0<i.thrownErrors.length)throw e=A(i.thrownErrors),i.thrownErrors.length=0,e;return{then:function(d,m){r=!0,o===0?(i.actQueue=n,S(function(){return Y(y,d,m)})):d(y)}}},c.cache=function(e){return function(){return e.apply(null,arguments)}},c.cacheSignal=function(){return null},c.captureOwnerStack=function(){var e=i.getCurrentStack;return e===null?null:e()},c.cloneElement=function(e,a,o){if(e==null)throw Error("The argument must be a React element, but you passed "+e+".");var n=p1({},e.props),r=e.key,h=e._owner;if(a!=null){var s;e:{if(H.call(a,"ref")&&(s=Object.getOwnPropertyDescriptor(a,"ref").get)&&s.isReactWarning){s=!1;break e}s=a.ref!==void 0}s&&(h=J()),t1(a)&&(w(a.key),r=""+a.key);for(y in a)!H.call(a,y)||y==="key"||y==="__self"||y==="__source"||y==="ref"&&a.ref===void 0||(n[y]=a[y])}var y=arguments.length-2;if(y===1)n.children=o;else if(1<y){s=Array(y);for(var d=0;d<y;d++)s[d]=arguments[d+2];n.children=s}for(n=D(e.type,r,n,h,e._debugStack,e._debugTask),r=2;r<arguments.length;r++)a1(arguments[r]);return n},c.createContext=function(e){return e={$$typeof:s1,_currentValue:e,_currentValue2:e,_threadCount:0,Provider:null,Consumer:null},e.Provider=e,e.Consumer={$$typeof:F,_context:e},e._currentRenderer=null,e._currentRenderer2=null,e},c.createElement=function(e,a,o){for(var n=2;n<arguments.length;n++)a1(arguments[n]);n={};var r=null;if(a!=null)for(d in v1||!("__self"in a)||"key"in a||(v1=!0,console.warn("Your app (or one of its dependencies) is using an outdated JSX transform. Update to the modern JSX transform for faster performance: https://react.dev/link/new-jsx-transform")),t1(a)&&(w(a.key),r=""+a.key),a)H.call(a,d)&&d!=="key"&&d!=="__self"&&d!=="__source"&&(n[d]=a[d]);var h=arguments.length-2;if(h===1)n.children=o;else if(1<h){for(var s=Array(h),y=0;y<h;y++)s[y]=arguments[y+2];Object.freeze&&Object.freeze(s),n.children=s}if(e&&e.defaultProps)for(d in h=e.defaultProps,h)n[d]===void 0&&(n[d]=h[d]);r&&z1(n,typeof e=="function"?e.displayName||e.name||"Unknown":e);var d=1e4>i.recentlyCreatedOwnerStacks++;return D(e,r,n,J(),d?Error("react-stack-top-frame"):H1,d?f1(Z(e)):L1)},c.createRef=function(){var e={current:null};return Object.seal(e),e},c.forwardRef=function(e){e!=null&&e.$$typeof===G?console.error("forwardRef requires a render function but received a `memo` component. Instead of forwardRef(memo(...)), use memo(forwardRef(...))."):typeof e!="function"?console.error("forwardRef requires a render function but was given %s.",e===null?"null":typeof e):e.length!==0&&e.length!==2&&console.error("forwardRef render functions accept exactly two parameters: props and ref. %s",e.length===1?"Did you forget to use the ref parameter?":"Any additional parameter will be undefined."),e!=null&&e.defaultProps!=null&&console.error("forwardRef render functions do not support defaultProps. Did you accidentally pass a React component?");var a={$$typeof:i1,render:e},o;return Object.defineProperty(a,"displayName",{enumerable:!1,configurable:!0,get:function(){return o},set:function(n){o=n,e.name||e.displayName||(Object.defineProperty(e,"name",{value:n}),e.displayName=n)}}),a},c.isValidElement=b,c.lazy=function(e){e={_status:-1,_result:e};var a={$$typeof:C,_payload:e,_init:T1},o={name:"lazy",start:-1,end:-1,value:null,owner:null,debugStack:Error("react-stack-top-frame"),debugTask:console.createTask?console.createTask("lazy()"):null};return e._ioInfo=o,a._debugInfo=[{awaited:o}],a},c.memo=function(e,a){e==null&&console.error("memo: The first argument must be a component. Instead received: %s",e===null?"null":typeof e),a={$$typeof:G,type:e,compare:a===void 0?null:a};var o;return Object.defineProperty(a,"displayName",{enumerable:!1,configurable:!0,get:function(){return o},set:function(n){o=n,e.name||e.displayName||(Object.defineProperty(e,"name",{value:n}),e.displayName=n)}}),a},c.startTransition=function(e){var a=i.T,o={};o._updatedFibers=new Set,i.T=o;try{var n=e(),r=i.S;r!==null&&r(o,n),typeof n=="object"&&n!==null&&typeof n.then=="function"&&(i.asyncTransitions++,n.then(o1,o1),n.then($,w1))}catch(h){w1(h)}finally{a===null&&o._updatedFibers&&(e=o._updatedFibers.size,o._updatedFibers.clear(),10<e&&console.warn("Detected a large number of updates inside startTransition. If this is due to a subscription please re-write it to use React provided hooks. Otherwise concurrent mode guarantees are off the table.")),a!==null&&o.types!==null&&(a.types!==null&&a.types!==o.types&&console.error("We expected inner Transitions to have transferred the outer types set and that you cannot add to the outer Transition while inside the inner.This is a bug in React."),a.types=o.types),i.T=a}},c.unstable_useCacheRefresh=function(){return u().useCacheRefresh()},c.use=function(e){return u().use(e)},c.useActionState=function(e,a,o){return u().useActionState(e,a,o)},c.useCallback=function(e,a){return u().useCallback(e,a)},c.useContext=function(e){var a=u();return e.$$typeof===F&&console.error("Calling useContext(Context.Consumer) is not supported and will cause bugs. Did you mean to call useContext(Context) instead?"),a.useContext(e)},c.useDebugValue=function(e,a){return u().useDebugValue(e,a)},c.useDeferredValue=function(e,a){return u().useDeferredValue(e,a)},c.useEffect=function(e,a){return e==null&&console.warn("React Hook useEffect requires an effect callback. Did you forget to pass a callback to the hook?"),u().useEffect(e,a)},c.useEffectEvent=function(e){return u().useEffectEvent(e)},c.useId=function(){return u().useId()},c.useImperativeHandle=function(e,a,o){return u().useImperativeHandle(e,a,o)},c.useInsertionEffect=function(e,a){return e==null&&console.warn("React Hook useInsertionEffect requires an effect callback. Did you forget to pass a callback to the hook?"),u().useInsertionEffect(e,a)},c.useLayoutEffect=function(e,a){return e==null&&console.warn("React Hook useLayoutEffect requires an effect callback. Did you forget to pass a callback to the hook?"),u().useLayoutEffect(e,a)},c.useMemo=function(e,a){return u().useMemo(e,a)},c.useOptimistic=function(e,a){return u().useOptimistic(e,a)},c.useReducer=function(e,a,o){return u().useReducer(e,a,o)},c.useRef=function(e){return u().useRef(e)},c.useState=function(e){return u().useState(e)},c.useSyncExternalStore=function(e,a,o){return u().useSyncExternalStore(e,a,o)},c.useTransition=function(){return u().useTransition()},c.version="19.2.8",typeof __REACT_DEVTOOLS_GLOBAL_HOOK__<"u"&&typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStop=="function"&&__REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStop(Error())})()})(E,E.exports)),E.exports}var $1;function W1(){return $1||($1=1,X.exports=Y1()),X.exports}var M=W1();const I1=D1(M),N2=U1({__proto__:null,default:I1},[M]);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const B1=l=>l.replace(/([a-z0-9])([A-Z])/g,"$1-$2").toLowerCase(),F1=l=>l.replace(/^([A-Z])|[\s-_]+(\w)/g,(c,f,k)=>k?k.toUpperCase():f.toLowerCase()),A1=l=>{const c=F1(l);return c.charAt(0).toUpperCase()+c.slice(1)},C1=(...l)=>l.filter((c,f,k)=>!!c&&c.trim()!==""&&k.indexOf(c)===f).join(" ").trim(),G1=l=>{for(const c in l)if(c.startsWith("aria-")||c==="role"||c==="title")return!0};/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */var Q1={xmlns:"http://www.w3.org/2000/svg",width:24,height:24,viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:2,strokeLinecap:"round",strokeLinejoin:"round"};/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const K1=M.forwardRef(({color:l="currentColor",size:c=24,strokeWidth:f=2,absoluteStrokeWidth:k,className:_="",children:p,iconNode:q,...g},$)=>M.createElement("svg",{ref:$,...Q1,width:c,height:c,stroke:l,strokeWidth:k?Number(f)*24/Number(c):f,className:C1("lucide",_),...!p&&!G1(g)&&{"aria-hidden":"true"},...g},[...q.map(([j,w])=>M.createElement(j,w)),...Array.isArray(p)?p:[p]]));/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const t=(l,c)=>{const f=M.forwardRef(({className:k,..._},p)=>M.createElement(K1,{ref:p,iconNode:c,className:C1(`lucide-${B1(A1(l))}`,`lucide-${l}`,k),..._}));return f.displayName=A1(l),f};/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const X1=[["path",{d:"M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2",key:"169zse"}]],$2=t("activity",X1);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Z1=[["path",{d:"M12 22V8",key:"qkxhtm"}],["path",{d:"M5 12H2a10 10 0 0 0 20 0h-3",key:"1hv3nh"}],["circle",{cx:"12",cy:"5",r:"3",key:"rqqgnr"}]],A2=t("anchor",Z1);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const J1=[["rect",{width:"20",height:"5",x:"2",y:"3",rx:"1",key:"1wp1u1"}],["path",{d:"M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8",key:"1s80jp"}],["path",{d:"M10 12h4",key:"a56b0p"}]],C2=t("archive",J1);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const ee=[["path",{d:"M17 7 7 17",key:"15tmo1"}],["path",{d:"M17 17H7V7",key:"1org7z"}]],z2=t("arrow-down-left",ee);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const te=[["path",{d:"m7 7 10 10",key:"1fmybs"}],["path",{d:"M17 7v10H7",key:"6fjiku"}]],E2=t("arrow-down-right",te);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const ae=[["path",{d:"M12 17V3",key:"1cwfxf"}],["path",{d:"m6 11 6 6 6-6",key:"12ii2o"}],["path",{d:"M19 21H5",key:"150jfl"}]],q2=t("arrow-down-to-line",ae);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const oe=[["path",{d:"M12 5v14",key:"s699le"}],["path",{d:"m19 12-7 7-7-7",key:"1idqje"}]],j2=t("arrow-down",oe);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const ne=[["path",{d:"M8 3 4 7l4 4",key:"9rb6wj"}],["path",{d:"M4 7h16",key:"6tx8e3"}],["path",{d:"m16 21 4-4-4-4",key:"siv7j2"}],["path",{d:"M20 17H4",key:"h6l3hr"}]],R2=t("arrow-left-right",ne);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const ce=[["path",{d:"m12 19-7-7 7-7",key:"1l729n"}],["path",{d:"M19 12H5",key:"x3x0zl"}]],T2=t("arrow-left",ce);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const re=[["path",{d:"m16 3 4 4-4 4",key:"1x1c3m"}],["path",{d:"M20 7H4",key:"zbl0bi"}],["path",{d:"m8 21-4-4 4-4",key:"h9nckh"}],["path",{d:"M4 17h16",key:"g4d7ey"}]],S2=t("arrow-right-left",re);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const se=[["path",{d:"M5 12h14",key:"1ays0h"}],["path",{d:"m12 5 7 7-7 7",key:"xquz4c"}]],O2=t("arrow-right",se);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const ie=[["path",{d:"m21 16-4 4-4-4",key:"f6ql7i"}],["path",{d:"M17 20V4",key:"1ejh1v"}],["path",{d:"m3 8 4-4 4 4",key:"11wl7u"}],["path",{d:"M7 4v16",key:"1glfcx"}]],H2=t("arrow-up-down",ie);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const he=[["path",{d:"M7 7h10v10",key:"1tivn9"}],["path",{d:"M7 17 17 7",key:"1vkiza"}]],L2=t("arrow-up-right",he);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const de=[["path",{d:"M5 3h14",key:"7usisc"}],["path",{d:"m18 13-6-6-6 6",key:"1kf1n9"}],["path",{d:"M12 7v14",key:"1akyts"}]],V2=t("arrow-up-to-line",de);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const ye=[["path",{d:"m5 12 7-7 7 7",key:"hav0vg"}],["path",{d:"M12 19V5",key:"x0mq9r"}]],P2=t("arrow-up",ye);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const le=[["circle",{cx:"12",cy:"12",r:"4",key:"4exip2"}],["path",{d:"M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-4 8",key:"7n84p3"}]],D2=t("at-sign",le);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const ue=[["path",{d:"m15.477 12.89 1.515 8.526a.5.5 0 0 1-.81.47l-3.58-2.687a1 1 0 0 0-1.197 0l-3.586 2.686a.5.5 0 0 1-.81-.469l1.514-8.526",key:"1yiouv"}],["circle",{cx:"12",cy:"8",r:"6",key:"1vp47v"}]],U2=t("award",ue);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const pe=[["path",{d:"M4.929 4.929 19.07 19.071",key:"196cmz"}],["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}]],Y2=t("ban",pe);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const ke=[["rect",{width:"20",height:"12",x:"2",y:"6",rx:"2",key:"9lu3g6"}],["circle",{cx:"12",cy:"12",r:"2",key:"1c9p78"}],["path",{d:"M6 12h.01M18 12h.01",key:"113zkx"}]],W2=t("banknote",ke);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const fe=[["path",{d:"M10.268 21a2 2 0 0 0 3.464 0",key:"vwvbt9"}],["path",{d:"M17 17H4a1 1 0 0 1-.74-1.673C4.59 13.956 6 12.499 6 8a6 6 0 0 1 .258-1.742",key:"178tsu"}],["path",{d:"m2 2 20 20",key:"1ooewy"}],["path",{d:"M8.668 3.01A6 6 0 0 1 18 8c0 2.687.77 4.653 1.707 6.05",key:"1hqiys"}]],I2=t("bell-off",fe);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const _e=[["path",{d:"M10.268 21a2 2 0 0 0 3.464 0",key:"vwvbt9"}],["path",{d:"M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326",key:"11g9vi"}]],B2=t("bell",_e);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const ve=[["path",{d:"M12 7v14",key:"1akyts"}],["path",{d:"M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z",key:"ruj8y"}]],F2=t("book-open",ve);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const me=[["path",{d:"m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z",key:"1fy3hk"}]],G2=t("bookmark",me);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Me=[["path",{d:"M12 8V4H8",key:"hb8ula"}],["rect",{width:"16",height:"12",x:"4",y:"8",rx:"2",key:"enze0r"}],["path",{d:"M2 14h2",key:"vft8re"}],["path",{d:"M20 14h2",key:"4cs60a"}],["path",{d:"M15 13v2",key:"1xurst"}],["path",{d:"M9 13v2",key:"rq6x2g"}]],Q2=t("bot",Me);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const ge=[["path",{d:"M10 12h4",key:"a56b0p"}],["path",{d:"M10 8h4",key:"1sr2af"}],["path",{d:"M14 21v-3a2 2 0 0 0-4 0v3",key:"1rgiei"}],["path",{d:"M6 10H4a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-2",key:"secmi2"}],["path",{d:"M6 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16",key:"16ra0t"}]],K2=t("building-2",ge);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const we=[["path",{d:"M12 10h.01",key:"1nrarc"}],["path",{d:"M12 14h.01",key:"1etili"}],["path",{d:"M12 6h.01",key:"1vi96p"}],["path",{d:"M16 10h.01",key:"1m94wz"}],["path",{d:"M16 14h.01",key:"1gbofw"}],["path",{d:"M16 6h.01",key:"1x0f13"}],["path",{d:"M8 10h.01",key:"19clt8"}],["path",{d:"M8 14h.01",key:"6423bh"}],["path",{d:"M8 6h.01",key:"1dz90k"}],["path",{d:"M9 22v-3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3",key:"cabbwy"}],["rect",{x:"4",y:"2",width:"16",height:"20",rx:"2",key:"1uxh74"}]],X2=t("building",we);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const be=[["path",{d:"M8 6v6",key:"18i7km"}],["path",{d:"M15 6v6",key:"1sg6z9"}],["path",{d:"M2 12h19.6",key:"de5uta"}],["path",{d:"M18 18h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2 0-.4-.1-.8-.2-1.2l-1.4-5C20.1 6.8 19.1 6 18 6H4a2 2 0 0 0-2 2v10h3",key:"1wwztk"}],["circle",{cx:"7",cy:"18",r:"2",key:"19iecd"}],["path",{d:"M9 18h5",key:"lrx6i"}],["circle",{cx:"16",cy:"18",r:"2",key:"1v4tcr"}]],Z2=t("bus",be);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const xe=[["path",{d:"M8 2v4",key:"1cmpym"}],["path",{d:"M16 2v4",key:"4m81vk"}],["rect",{width:"18",height:"18",x:"3",y:"4",rx:"2",key:"1hopcy"}],["path",{d:"M3 10h18",key:"8toen8"}],["path",{d:"M8 14h.01",key:"6423bh"}],["path",{d:"M12 14h.01",key:"1etili"}],["path",{d:"M16 14h.01",key:"1gbofw"}],["path",{d:"M8 18h.01",key:"lrp35t"}],["path",{d:"M12 18h.01",key:"mhygvu"}],["path",{d:"M16 18h.01",key:"kzsmim"}]],J2=t("calendar-days",xe);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Ne=[["path",{d:"M8 2v4",key:"1cmpym"}],["path",{d:"M16 2v4",key:"4m81vk"}],["rect",{width:"18",height:"18",x:"3",y:"4",rx:"2",key:"1hopcy"}],["path",{d:"M3 10h18",key:"8toen8"}],["path",{d:"m14 14-4 4",key:"rymu2i"}],["path",{d:"m10 14 4 4",key:"3sz06r"}]],eo=t("calendar-x",Ne);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const $e=[["path",{d:"M8 2v4",key:"1cmpym"}],["path",{d:"M16 2v4",key:"4m81vk"}],["rect",{width:"18",height:"18",x:"3",y:"4",rx:"2",key:"1hopcy"}],["path",{d:"M3 10h18",key:"8toen8"}]],to=t("calendar",$e);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Ae=[["path",{d:"M13.997 4a2 2 0 0 1 1.76 1.05l.486.9A2 2 0 0 0 18.003 7H20a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h1.997a2 2 0 0 0 1.759-1.048l.489-.904A2 2 0 0 1 10.004 4z",key:"18u6gg"}],["circle",{cx:"12",cy:"13",r:"3",key:"1vg3eu"}]],ao=t("camera",Ae);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Ce=[["path",{d:"M3 3v16a2 2 0 0 0 2 2h16",key:"c24i48"}],["path",{d:"M18 17V9",key:"2bz60n"}],["path",{d:"M13 17V5",key:"1frdt8"}],["path",{d:"M8 17v-3",key:"17ska0"}]],oo=t("chart-column",Ce);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const ze=[["path",{d:"M5 21v-6",key:"1hz6c0"}],["path",{d:"M12 21V3",key:"1lcnhd"}],["path",{d:"M19 21V9",key:"unv183"}]],no=t("chart-no-axes-column",ze);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Ee=[["path",{d:"M21 12c.552 0 1.005-.449.95-.998a10 10 0 0 0-8.953-8.951c-.55-.055-.998.398-.998.95v8a1 1 0 0 0 1 1z",key:"pzmjnu"}],["path",{d:"M21.21 15.89A10 10 0 1 1 8 2.83",key:"k2fpak"}]],co=t("chart-pie",Ee);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const qe=[["path",{d:"M18 6 7 17l-5-5",key:"116fxf"}],["path",{d:"m22 10-7.5 7.5L13 16",key:"ke71qq"}]],ro=t("check-check",qe);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const je=[["path",{d:"M20 6 9 17l-5-5",key:"1gmf2c"}]],so=t("check",je);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Re=[["path",{d:"m6 9 6 6 6-6",key:"qrunsl"}]],io=t("chevron-down",Re);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Te=[["path",{d:"m15 18-6-6 6-6",key:"1wnfg3"}]],ho=t("chevron-left",Te);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Se=[["path",{d:"m9 18 6-6-6-6",key:"mthhwq"}]],yo=t("chevron-right",Se);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Oe=[["path",{d:"m18 15-6-6-6 6",key:"153udz"}]],lo=t("chevron-up",Oe);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const He=[["path",{d:"m11 17-5-5 5-5",key:"13zhaf"}],["path",{d:"m18 17-5-5 5-5",key:"h8a8et"}]],uo=t("chevrons-left",He);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Le=[["path",{d:"m6 17 5-5-5-5",key:"xnjwq"}],["path",{d:"m13 17 5-5-5-5",key:"17xmmf"}]],po=t("chevrons-right",Le);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Ve=[["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}],["line",{x1:"12",x2:"12",y1:"8",y2:"12",key:"1pkeuh"}],["line",{x1:"12",x2:"12.01",y1:"16",y2:"16",key:"4dfq90"}]],ko=t("circle-alert",Ve);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Pe=[["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}],["path",{d:"m9 12 2 2 4-4",key:"dzmm74"}]],fo=t("circle-check",Pe);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const De=[["path",{d:"M9 9.003a1 1 0 0 1 1.517-.859l4.997 2.997a1 1 0 0 1 0 1.718l-4.997 2.997A1 1 0 0 1 9 14.996z",key:"kmsa83"}],["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}]],_o=t("circle-play",De);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Ue=[["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}],["path",{d:"M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3",key:"1u773s"}],["path",{d:"M12 17h.01",key:"p32p05"}]],vo=t("circle-question-mark",Ue);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Ye=[["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}],["path",{d:"m15 9-6 6",key:"1uzhvr"}],["path",{d:"m9 9 6 6",key:"z0biqf"}]],mo=t("circle-x",Ye);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const We=[["rect",{width:"8",height:"4",x:"8",y:"2",rx:"1",ry:"1",key:"tgr4d6"}],["path",{d:"M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2",key:"116196"}],["path",{d:"m9 14 2 2 4-4",key:"df797q"}]],Mo=t("clipboard-check",We);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Ie=[["rect",{width:"8",height:"4",x:"8",y:"2",rx:"1",ry:"1",key:"tgr4d6"}],["path",{d:"M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2",key:"116196"}],["path",{d:"M12 11h4",key:"1jrz19"}],["path",{d:"M12 16h4",key:"n85exb"}],["path",{d:"M8 11h.01",key:"1dfujw"}],["path",{d:"M8 16h.01",key:"18s6g9"}]],go=t("clipboard-list",Ie);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Be=[["path",{d:"M12 6v6l4 2",key:"mmk7yg"}],["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}]],wo=t("clock",Be);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Fe=[["path",{d:"M12 13v8",key:"1l5pq0"}],["path",{d:"M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242",key:"1pljnt"}],["path",{d:"m8 17 4-4 4 4",key:"1quai1"}]],bo=t("cloud-upload",Fe);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Ge=[["path",{d:"m18 16 4-4-4-4",key:"1inbqp"}],["path",{d:"m6 8-4 4 4 4",key:"15zrgr"}],["path",{d:"m14.5 4-5 16",key:"e7oirm"}]],xo=t("code-xml",Ge);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Qe=[["circle",{cx:"8",cy:"8",r:"6",key:"3yglwk"}],["path",{d:"M18.09 10.37A6 6 0 1 1 10.34 18",key:"t5s6rm"}],["path",{d:"M7 6h1v4",key:"1obek4"}],["path",{d:"m16.71 13.88.7.71-2.82 2.82",key:"1rbuyh"}]],No=t("coins",Qe);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Ke=[["path",{d:"M10 2v2",key:"7u0qdc"}],["path",{d:"M14 2v2",key:"6buw04"}],["path",{d:"M16 8a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h14a4 4 0 1 1 0 8h-1",key:"pwadti"}],["path",{d:"M6 2v2",key:"colzsn"}]],$o=t("coffee",Ke);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Xe=[["rect",{width:"14",height:"14",x:"8",y:"8",rx:"2",ry:"2",key:"17jyea"}],["path",{d:"M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2",key:"zix9uf"}]],Ao=t("copy",Xe);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Ze=[["path",{d:"M12 20v2",key:"1lh1kg"}],["path",{d:"M12 2v2",key:"tus03m"}],["path",{d:"M17 20v2",key:"1rnc9c"}],["path",{d:"M17 2v2",key:"11trls"}],["path",{d:"M2 12h2",key:"1t8f8n"}],["path",{d:"M2 17h2",key:"7oei6x"}],["path",{d:"M2 7h2",key:"asdhe0"}],["path",{d:"M20 12h2",key:"1q8mjw"}],["path",{d:"M20 17h2",key:"1fpfkl"}],["path",{d:"M20 7h2",key:"1o8tra"}],["path",{d:"M7 20v2",key:"4gnj0m"}],["path",{d:"M7 2v2",key:"1i4yhu"}],["rect",{x:"4",y:"4",width:"16",height:"16",rx:"2",key:"1vbyd7"}],["rect",{x:"8",y:"8",width:"8",height:"8",rx:"1",key:"z9xiuo"}]],Co=t("cpu",Ze);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Je=[["rect",{width:"20",height:"14",x:"2",y:"5",rx:"2",key:"ynyp8z"}],["line",{x1:"2",x2:"22",y1:"10",y2:"10",key:"1b3vmo"}]],zo=t("credit-card",Je);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const et=[["path",{d:"M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.734H5.81a1 1 0 0 1-.957-.734L2.02 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294z",key:"1vdc57"}],["path",{d:"M5 21h14",key:"11awu3"}]],Eo=t("crown",et);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const tt=[["ellipse",{cx:"12",cy:"5",rx:"9",ry:"3",key:"msslwz"}],["path",{d:"M3 5V19A9 3 0 0 0 21 19V5",key:"1wlel7"}],["path",{d:"M3 12A9 3 0 0 0 21 12",key:"mv7ke4"}]],qo=t("database",tt);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const at=[["rect",{width:"12",height:"12",x:"2",y:"10",rx:"2",ry:"2",key:"6agr2n"}],["path",{d:"m17.92 14 3.5-3.5a2.24 2.24 0 0 0 0-3l-5-4.92a2.24 2.24 0 0 0-3 0L10 6",key:"1o487t"}],["path",{d:"M6 18h.01",key:"uhywen"}],["path",{d:"M10 14h.01",key:"ssrbsk"}],["path",{d:"M15 6h.01",key:"cblpky"}],["path",{d:"M18 9h.01",key:"2061c0"}]],jo=t("dices",at);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const ot=[["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}],["circle",{cx:"12",cy:"12",r:"2",key:"1c9p78"}]],Ro=t("disc",ot);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const nt=[["line",{x1:"12",x2:"12",y1:"2",y2:"22",key:"7eqyqh"}],["path",{d:"M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6",key:"1b0p4s"}]],To=t("dollar-sign",nt);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const ct=[["path",{d:"M12 15V3",key:"m9g1x1"}],["path",{d:"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4",key:"ih7n3h"}],["path",{d:"m7 10 5 5 5-5",key:"brsn70"}]],So=t("download",ct);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const rt=[["path",{d:"M7 16.3c2.2 0 4-1.83 4-4.05 0-1.16-.57-2.26-1.71-3.19S7.29 6.75 7 5.3c-.29 1.45-1.14 2.84-2.29 3.76S3 11.1 3 12.25c0 2.22 1.8 4.05 4 4.05z",key:"1ptgy4"}],["path",{d:"M12.56 6.6A10.97 10.97 0 0 0 14 3.02c.5 2.5 2 4.9 4 6.5s3 3.5 3 5.5a6.98 6.98 0 0 1-11.91 4.97",key:"1sl1rz"}]],Oo=t("droplets",rt);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const st=[["circle",{cx:"12",cy:"12",r:"1",key:"41hilf"}],["circle",{cx:"12",cy:"5",r:"1",key:"gxeob9"}],["circle",{cx:"12",cy:"19",r:"1",key:"lyex9k"}]],Ho=t("ellipsis-vertical",st);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const it=[["path",{d:"M15 3h6v6",key:"1q9fwt"}],["path",{d:"M10 14 21 3",key:"gplh6r"}],["path",{d:"M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6",key:"a6xqqp"}]],Lo=t("external-link",it);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const ht=[["path",{d:"M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0",key:"1nclc0"}],["circle",{cx:"12",cy:"12",r:"3",key:"1v7zrd"}]],Vo=t("eye",ht);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const dt=[["path",{d:"M12 16h.01",key:"1drbdi"}],["path",{d:"M16 16h.01",key:"1f9h7w"}],["path",{d:"M3 19a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8.5a.5.5 0 0 0-.769-.422l-4.462 2.844A.5.5 0 0 1 15 10.5v-2a.5.5 0 0 0-.769-.422L9.77 10.922A.5.5 0 0 1 9 10.5V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2z",key:"1iv0i2"}],["path",{d:"M8 16h.01",key:"18s6g9"}]],Po=t("factory",dt);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const yt=[["path",{d:"M12 6a2 2 0 0 1 3.414-1.414l6 6a2 2 0 0 1 0 2.828l-6 6A2 2 0 0 1 12 18z",key:"b19h5q"}],["path",{d:"M2 6a2 2 0 0 1 3.414-1.414l6 6a2 2 0 0 1 0 2.828l-6 6A2 2 0 0 1 2 18z",key:"h7h5ge"}]],Do=t("fast-forward",yt);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const lt=[["path",{d:"M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z",key:"1rqfz7"}],["path",{d:"M14 2v4a2 2 0 0 0 2 2h4",key:"tnqrlb"}],["path",{d:"m9 15 2 2 4-4",key:"1grp1n"}]],Uo=t("file-check",lt);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const ut=[["path",{d:"M10 12.5 8 15l2 2.5",key:"1tg20x"}],["path",{d:"m14 12.5 2 2.5-2 2.5",key:"yinavb"}],["path",{d:"M14 2v4a2 2 0 0 0 2 2h4",key:"tnqrlb"}],["path",{d:"M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z",key:"1mlx9k"}]],Yo=t("file-code",ut);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const pt=[["path",{d:"M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z",key:"1rqfz7"}],["path",{d:"M14 2v4a2 2 0 0 0 2 2h4",key:"tnqrlb"}],["path",{d:"M8 13h2",key:"yr2amv"}],["path",{d:"M14 13h2",key:"un5t4a"}],["path",{d:"M8 17h2",key:"2yhykz"}],["path",{d:"M14 17h2",key:"10kma7"}]],Wo=t("file-spreadsheet",pt);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const kt=[["path",{d:"M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z",key:"1rqfz7"}],["path",{d:"M14 2v4a2 2 0 0 0 2 2h4",key:"tnqrlb"}],["path",{d:"M10 9H8",key:"b1mrlr"}],["path",{d:"M16 13H8",key:"t4e002"}],["path",{d:"M16 17H8",key:"z1uh3a"}]],Io=t("file-text",kt);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const ft=[["path",{d:"M4 22V4a1 1 0 0 1 .4-.8A6 6 0 0 1 8 2c3 0 5 2 7.333 2q2 0 3.067-.8A1 1 0 0 1 20 4v10a1 1 0 0 1-.4.8A6 6 0 0 1 16 16c-3 0-5-2-8-2a6 6 0 0 0-4 1.528",key:"1jaruq"}]],Bo=t("flag",ft);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const _t=[["path",{d:"M12 3q1 4 4 6.5t3 5.5a1 1 0 0 1-14 0 5 5 0 0 1 1-3 1 1 0 0 0 5 0c0-2-1.5-3-1.5-5q0-2 2.5-4",key:"1slcih"}]],Fo=t("flame",_t);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const vt=[["path",{d:"M8 3H5a2 2 0 0 0-2 2v14c0 1.1.9 2 2 2h3",key:"1i73f7"}],["path",{d:"M16 3h3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-3",key:"saxlbk"}],["path",{d:"M12 20v2",key:"1lh1kg"}],["path",{d:"M12 14v2",key:"8jcxud"}],["path",{d:"M12 8v2",key:"1woqiv"}],["path",{d:"M12 2v2",key:"tus03m"}]],Go=t("flip-horizontal",vt);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const mt=[["path",{d:"M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z",key:"1kt360"}],["path",{d:"M12 10v6",key:"1bos4e"}],["path",{d:"m15 13-3 3-3-3",key:"6j2sf0"}]],Qo=t("folder-down",mt);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Mt=[["path",{d:"M10 20a1 1 0 0 0 .553.895l2 1A1 1 0 0 0 14 21v-7a2 2 0 0 1 .517-1.341L21.74 4.67A1 1 0 0 0 21 3H3a1 1 0 0 0-.742 1.67l7.225 7.989A2 2 0 0 1 10 14z",key:"sc7q7i"}]],Ko=t("funnel",Mt);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const gt=[["line",{x1:"6",x2:"10",y1:"11",y2:"11",key:"1gktln"}],["line",{x1:"8",x2:"8",y1:"9",y2:"13",key:"qnk9ow"}],["line",{x1:"15",x2:"15.01",y1:"12",y2:"12",key:"krot7o"}],["line",{x1:"18",x2:"18.01",y1:"10",y2:"10",key:"1lcuu1"}],["path",{d:"M17.32 5H6.68a4 4 0 0 0-3.978 3.59c-.006.052-.01.101-.017.152C2.604 9.416 2 14.456 2 16a3 3 0 0 0 3 3c1 0 1.5-.5 2-1l1.414-1.414A2 2 0 0 1 9.828 16h4.344a2 2 0 0 1 1.414.586L17 18c.5.5 1 1 2 1a3 3 0 0 0 3-3c0-1.545-.604-6.584-.685-7.258-.007-.05-.011-.1-.017-.151A4 4 0 0 0 17.32 5z",key:"mfqc10"}]],Xo=t("gamepad-2",gt);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const wt=[["path",{d:"m14 13-8.381 8.38a1 1 0 0 1-3.001-3l8.384-8.381",key:"pgg06f"}],["path",{d:"m16 16 6-6",key:"vzrcl6"}],["path",{d:"m21.5 10.5-8-8",key:"a17d9x"}],["path",{d:"m8 8 6-6",key:"18bi4p"}],["path",{d:"m8.5 7.5 8 8",key:"1oyaui"}]],Zo=t("gavel",wt);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const bt=[["path",{d:"M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z",key:"j76jl0"}],["path",{d:"M22 10v6",key:"1lu8f3"}],["path",{d:"M6 12.5V16a6 3 0 0 0 12 0v-3.5",key:"1r8lef"}]],Jo=t("graduation-cap",bt);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const xt=[["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}],["path",{d:"M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20",key:"13o1zl"}],["path",{d:"M2 12h20",key:"9i4pu4"}]],en=t("globe",xt);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Nt=[["line",{x1:"22",x2:"2",y1:"12",y2:"12",key:"1y58io"}],["path",{d:"M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z",key:"oot6mr"}],["line",{x1:"6",x2:"6.01",y1:"16",y2:"16",key:"sgf278"}],["line",{x1:"10",x2:"10.01",y1:"16",y2:"16",key:"1l4acy"}]],tn=t("hard-drive",Nt);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const $t=[["line",{x1:"4",x2:"20",y1:"9",y2:"9",key:"4lhtct"}],["line",{x1:"4",x2:"20",y1:"15",y2:"15",key:"vyu0kd"}],["line",{x1:"10",x2:"8",y1:"3",y2:"21",key:"1ggp8o"}],["line",{x1:"16",x2:"14",y1:"3",y2:"21",key:"weycgp"}]],an=t("hash",$t);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const At=[["path",{d:"M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5",key:"mvr1a0"}]],on=t("heart",At);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Ct=[["path",{d:"M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8",key:"1357e3"}],["path",{d:"M3 3v5h5",key:"1xhq8a"}],["path",{d:"M12 7v5l4 2",key:"1fdv2h"}]],nn=t("history",Ct);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const zt=[["path",{d:"M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8",key:"5wwlr5"}],["path",{d:"M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z",key:"r6nss1"}]],cn=t("house",zt);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Et=[["rect",{width:"18",height:"18",x:"3",y:"3",rx:"2",ry:"2",key:"1m3agn"}],["circle",{cx:"9",cy:"9",r:"2",key:"af1f0g"}],["path",{d:"m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21",key:"1xmnt7"}]],rn=t("image",Et);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const qt=[["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}],["path",{d:"M12 16v-4",key:"1dtifu"}],["path",{d:"M12 8h.01",key:"e9boi3"}]],sn=t("info",qt);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const jt=[["path",{d:"M2.586 17.414A2 2 0 0 0 2 18.828V21a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h1a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h.172a2 2 0 0 0 1.414-.586l.814-.814a6.5 6.5 0 1 0-4-4z",key:"1s6t7t"}],["circle",{cx:"16.5",cy:"7.5",r:".5",fill:"currentColor",key:"w0ekpg"}]],hn=t("key-round",jt);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Rt=[["path",{d:"m15.5 7.5 2.3 2.3a1 1 0 0 0 1.4 0l2.1-2.1a1 1 0 0 0 0-1.4L19 4",key:"g0fldk"}],["path",{d:"m21 2-9.6 9.6",key:"1j0ho8"}],["circle",{cx:"7.5",cy:"15.5",r:"5.5",key:"yqb3hr"}]],dn=t("key",Rt);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Tt=[["path",{d:"M10 18v-7",key:"wt116b"}],["path",{d:"M11.12 2.198a2 2 0 0 1 1.76.006l7.866 3.847c.476.233.31.949-.22.949H3.474c-.53 0-.695-.716-.22-.949z",key:"1m329m"}],["path",{d:"M14 18v-7",key:"vav6t3"}],["path",{d:"M18 18v-7",key:"aexdmj"}],["path",{d:"M3 22h18",key:"8prr45"}],["path",{d:"M6 18v-7",key:"1ivflk"}]],yn=t("landmark",Tt);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const St=[["path",{d:"M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83z",key:"zw3jo"}],["path",{d:"M2 12a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 12",key:"1wduqc"}],["path",{d:"M2 17a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 17",key:"kqbvx6"}]],ln=t("layers",St);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Ot=[["rect",{width:"7",height:"9",x:"3",y:"3",rx:"1",key:"10lvy0"}],["rect",{width:"7",height:"5",x:"14",y:"3",rx:"1",key:"16une8"}],["rect",{width:"7",height:"9",x:"14",y:"12",rx:"1",key:"1hutg5"}],["rect",{width:"7",height:"5",x:"3",y:"16",rx:"1",key:"ldoo1y"}]],un=t("layout-dashboard",Ot);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Ht=[["path",{d:"M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5",key:"1gvzjb"}],["path",{d:"M9 18h6",key:"x1upvd"}],["path",{d:"M10 22h4",key:"ceow96"}]],pn=t("lightbulb",Ht);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Lt=[["path",{d:"M9 17H7A5 5 0 0 1 7 7h2",key:"8i5ue5"}],["path",{d:"M15 7h2a5 5 0 1 1 0 10h-2",key:"1b9ql8"}],["line",{x1:"8",x2:"16",y1:"12",y2:"12",key:"1jonct"}]],kn=t("link-2",Lt);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Vt=[["path",{d:"M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71",key:"1cjeqo"}],["path",{d:"M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71",key:"19qd67"}]],fn=t("link",Vt);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Pt=[["path",{d:"M13 5h8",key:"a7qcls"}],["path",{d:"M13 12h8",key:"h98zly"}],["path",{d:"M13 19h8",key:"c3s6r1"}],["path",{d:"m3 17 2 2 4-4",key:"1jhpwq"}],["rect",{x:"3",y:"4",width:"6",height:"6",rx:"1",key:"cif1o7"}]],_n=t("list-todo",Pt);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Dt=[["path",{d:"M21 12a9 9 0 1 1-6.219-8.56",key:"13zald"}]],vn=t("loader-circle",Dt);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Ut=[["rect",{width:"18",height:"11",x:"3",y:"11",rx:"2",ry:"2",key:"1w4ew1"}],["path",{d:"M7 11V7a5 5 0 0 1 10 0v4",key:"fwvmzm"}]],mn=t("lock",Ut);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Yt=[["path",{d:"m16 17 5-5-5-5",key:"1bji2h"}],["path",{d:"M21 12H9",key:"dn1m92"}],["path",{d:"M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4",key:"1uf3rs"}]],Mn=t("log-out",Yt);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Wt=[["path",{d:"m22 7-8.991 5.727a2 2 0 0 1-2.009 0L2 7",key:"132q7q"}],["rect",{x:"2",y:"4",width:"20",height:"16",rx:"2",key:"izxlao"}]],gn=t("mail",Wt);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const It=[["path",{d:"M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0",key:"1r0f0z"}],["circle",{cx:"12",cy:"10",r:"3",key:"ilqhr7"}]],wn=t("map-pin",It);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Bt=[["path",{d:"M16 3h5v5",key:"1806ms"}],["path",{d:"m21 3-6.75 6.75",key:"pv0uzu"}],["circle",{cx:"10",cy:"14",r:"6",key:"1qwbdc"}]],bn=t("mars",Bt);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Ft=[["path",{d:"M15 3h6v6",key:"1q9fwt"}],["path",{d:"m21 3-7 7",key:"1l2asr"}],["path",{d:"m3 21 7-7",key:"tjx5ai"}],["path",{d:"M9 21H3v-6",key:"wtvkvv"}]],xn=t("maximize-2",Ft);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Gt=[["path",{d:"M4 5h16",key:"1tepv9"}],["path",{d:"M4 12h16",key:"1lakjw"}],["path",{d:"M4 19h16",key:"1djgab"}]],Nn=t("menu",Gt);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Qt=[["path",{d:"M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719",key:"1sd12s"}]],$n=t("message-circle",Qt);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Kt=[["path",{d:"M22 17a2 2 0 0 1-2 2H6.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 2 21.286V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2z",key:"18887p"}],["path",{d:"m10 8-3 3 3 3",key:"fp6dz7"}],["path",{d:"m14 14 3-3-3-3",key:"1yrceu"}]],An=t("message-square-code",Kt);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Xt=[["path",{d:"M22 17a2 2 0 0 1-2 2H6.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 2 21.286V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2z",key:"18887p"}]],Cn=t("message-square",Xt);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Zt=[["path",{d:"m14 10 7-7",key:"oa77jy"}],["path",{d:"M20 10h-6V4",key:"mjg0md"}],["path",{d:"m3 21 7-7",key:"tjx5ai"}],["path",{d:"M4 14h6v6",key:"rmj7iw"}]],zn=t("minimize-2",Zt);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Jt=[["path",{d:"M5 12h14",key:"1ays0h"}]],En=t("minus",Jt);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const ea=[["path",{d:"M18 8V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h8",key:"10dyio"}],["path",{d:"M10 19v-3.96 3.15",key:"1irgej"}],["path",{d:"M7 19h5",key:"qswx4l"}],["rect",{width:"6",height:"10",x:"16",y:"12",rx:"2",key:"1egngj"}]],qn=t("monitor-smartphone",ea);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const ta=[["rect",{width:"20",height:"14",x:"2",y:"3",rx:"2",key:"48i651"}],["line",{x1:"8",x2:"16",y1:"21",y2:"21",key:"1svkeh"}],["line",{x1:"12",x2:"12",y1:"17",y2:"21",key:"vw1qmm"}]],jn=t("monitor",ta);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const aa=[["path",{d:"M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401",key:"kfwtm"}]],Rn=t("moon",aa);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const oa=[["path",{d:"M9 18V5l12-2v13",key:"1jmyc2"}],["circle",{cx:"6",cy:"18",r:"3",key:"fqmcym"}],["circle",{cx:"18",cy:"16",r:"3",key:"1hluhg"}]],Tn=t("music",oa);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const na=[["polygon",{points:"3 11 22 2 13 21 11 13 3 11",key:"1ltx0t"}]],Sn=t("navigation",na);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const ca=[["path",{d:"M12 22a1 1 0 0 1 0-20 10 9 0 0 1 10 9 5 5 0 0 1-5 5h-2.25a1.75 1.75 0 0 0-1.4 2.8l.3.4a1.75 1.75 0 0 1-1.4 2.8z",key:"e79jfc"}],["circle",{cx:"13.5",cy:"6.5",r:".5",fill:"currentColor",key:"1okk4w"}],["circle",{cx:"17.5",cy:"10.5",r:".5",fill:"currentColor",key:"f64h9f"}],["circle",{cx:"6.5",cy:"12.5",r:".5",fill:"currentColor",key:"qy21gx"}],["circle",{cx:"8.5",cy:"7.5",r:".5",fill:"currentColor",key:"fotxhn"}]],On=t("palette",ca);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const ra=[["rect",{width:"18",height:"18",x:"3",y:"3",rx:"2",key:"afitv7"}],["path",{d:"M9 3v18",key:"fh3hqa"}],["path",{d:"m16 15-3-3 3-3",key:"14y99z"}]],Hn=t("panel-left-close",ra);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const sa=[["rect",{width:"18",height:"18",x:"3",y:"3",rx:"2",key:"afitv7"}],["path",{d:"M9 3v18",key:"fh3hqa"}],["path",{d:"m14 9 3 3-3 3",key:"8010ee"}]],Ln=t("panel-left-open",sa);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const ia=[["rect",{width:"18",height:"18",x:"3",y:"3",rx:"2",key:"afitv7"}],["path",{d:"M3 9h18",key:"1pudct"}],["path",{d:"M9 21V9",key:"1oto5p"}]],Vn=t("panels-top-left",ia);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const ha=[["rect",{x:"14",y:"3",width:"5",height:"18",rx:"1",key:"kaeet6"}],["rect",{x:"5",y:"3",width:"5",height:"18",rx:"1",key:"1wsw3u"}]],Pn=t("pause",ha);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const da=[["path",{d:"M13 21h8",key:"1jsn5i"}],["path",{d:"M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z",key:"1a8usu"}]],Dn=t("pen-line",da);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const ya=[["path",{d:"M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z",key:"1a8usu"}]],Un=t("pen",ya);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const la=[["path",{d:"M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z",key:"1a8usu"}],["path",{d:"m15 5 4 4",key:"1mk7zo"}]],Yn=t("pencil",la);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const ua=[["path",{d:"M13.832 16.568a1 1 0 0 0 1.213-.303l.355-.465A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.468.351a1 1 0 0 0-.292 1.233 14 14 0 0 0 6.392 6.384",key:"9njp5v"}]],Wn=t("phone",ua);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const pa=[["path",{d:"M12 17v5",key:"bb1du9"}],["path",{d:"M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z",key:"1nkz8b"}]],In=t("pin",pa);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const ka=[["path",{d:"M5 5a2 2 0 0 1 3.008-1.728l11.997 6.998a2 2 0 0 1 .003 3.458l-12 7A2 2 0 0 1 5 19z",key:"10ikf1"}]],Bn=t("play",ka);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const fa=[["path",{d:"M5 12h14",key:"1ays0h"}],["path",{d:"M12 5v14",key:"s699le"}]],Fn=t("plus",fa);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const _a=[["path",{d:"M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2",key:"143wyd"}],["path",{d:"M6 9V3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v6",key:"1itne7"}],["rect",{x:"6",y:"14",width:"12",height:"8",rx:"1",key:"1ue0tg"}]],Gn=t("printer",_a);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const va=[["rect",{width:"5",height:"5",x:"3",y:"3",rx:"1",key:"1tu5fj"}],["rect",{width:"5",height:"5",x:"16",y:"3",rx:"1",key:"1v8r4q"}],["rect",{width:"5",height:"5",x:"3",y:"16",rx:"1",key:"1x03jg"}],["path",{d:"M21 16h-3a2 2 0 0 0-2 2v3",key:"177gqh"}],["path",{d:"M21 21v.01",key:"ents32"}],["path",{d:"M12 7v3a2 2 0 0 1-2 2H7",key:"8crl2c"}],["path",{d:"M3 12h.01",key:"nlz23k"}],["path",{d:"M12 3h.01",key:"n36tog"}],["path",{d:"M12 16v.01",key:"133mhm"}],["path",{d:"M16 12h1",key:"1slzba"}],["path",{d:"M21 12v.01",key:"1lwtk9"}],["path",{d:"M12 21v-1",key:"1880an"}]],Qn=t("qr-code",va);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const ma=[["path",{d:"M16 3a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2 1 1 0 0 1 1 1v1a2 2 0 0 1-2 2 1 1 0 0 0-1 1v2a1 1 0 0 0 1 1 6 6 0 0 0 6-6V5a2 2 0 0 0-2-2z",key:"rib7q0"}],["path",{d:"M5 3a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2 1 1 0 0 1 1 1v1a2 2 0 0 1-2 2 1 1 0 0 0-1 1v2a1 1 0 0 0 1 1 6 6 0 0 0 6-6V5a2 2 0 0 0-2-2z",key:"1ymkrd"}]],Kn=t("quote",ma);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Ma=[["path",{d:"M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8",key:"v9h5vc"}],["path",{d:"M21 3v5h-5",key:"1q7to0"}],["path",{d:"M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16",key:"3uifl3"}],["path",{d:"M8 16H3v5",key:"1cv678"}]],Xn=t("refresh-cw",Ma);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const ga=[["path",{d:"m17 2 4 4-4 4",key:"nntrym"}],["path",{d:"M3 11v-1a4 4 0 0 1 4-4h14",key:"84bu3i"}],["path",{d:"m7 22-4-4 4-4",key:"1wqhfi"}],["path",{d:"M21 13v1a4 4 0 0 1-4 4H3",key:"1rx37r"}]],Zn=t("repeat",ga);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const wa=[["path",{d:"M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z",key:"m3kijz"}],["path",{d:"m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z",key:"1fmvmk"}],["path",{d:"M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0",key:"1f8sc4"}],["path",{d:"M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5",key:"qeys4"}]],Jn=t("rocket",wa);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const ba=[["path",{d:"M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8",key:"1357e3"}],["path",{d:"M3 3v5h5",key:"1xhq8a"}]],e0=t("rotate-ccw",ba);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const xa=[["path",{d:"M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z",key:"1c8476"}],["path",{d:"M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7",key:"1ydtos"}],["path",{d:"M7 3v4a1 1 0 0 0 1 1h7",key:"t51u73"}]],t0=t("save",xa);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Na=[["path",{d:"M14 21v-3a2 2 0 0 0-4 0v3",key:"1rgiei"}],["path",{d:"M18 5v16",key:"1ethyx"}],["path",{d:"m4 6 7.106-3.79a2 2 0 0 1 1.788 0L20 6",key:"zywc2d"}],["path",{d:"m6 11-3.52 2.147a1 1 0 0 0-.48.854V19a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-5a1 1 0 0 0-.48-.853L18 11",key:"1d4ql0"}],["path",{d:"M6 5v16",key:"1sn0nx"}],["circle",{cx:"12",cy:"9",r:"2",key:"1092wv"}]],a0=t("school",Na);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const $a=[["path",{d:"M19 17V5a2 2 0 0 0-2-2H4",key:"zz82l3"}],["path",{d:"M8 21h12a2 2 0 0 0 2-2v-1a1 1 0 0 0-1-1H11a1 1 0 0 0-1 1v1a2 2 0 1 1-4 0V5a2 2 0 1 0-4 0v2a1 1 0 0 0 1 1h3",key:"1ph1d7"}]],o0=t("scroll",$a);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Aa=[["path",{d:"m21 21-4.34-4.34",key:"14j7rj"}],["circle",{cx:"11",cy:"11",r:"8",key:"4ej97u"}]],n0=t("search",Aa);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Ca=[["path",{d:"M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z",key:"1ffxy3"}],["path",{d:"m21.854 2.147-10.94 10.939",key:"12cjpa"}]],c0=t("send",Ca);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const za=[["rect",{width:"20",height:"8",x:"2",y:"2",rx:"2",ry:"2",key:"ngkwjq"}],["rect",{width:"20",height:"8",x:"2",y:"14",rx:"2",ry:"2",key:"iecqi9"}],["line",{x1:"6",x2:"6.01",y1:"6",y2:"6",key:"16zg32"}],["line",{x1:"6",x2:"6.01",y1:"18",y2:"18",key:"nzw8ys"}]],r0=t("server",za);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Ea=[["path",{d:"M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915",key:"1i5ecw"}],["circle",{cx:"12",cy:"12",r:"3",key:"1v7zrd"}]],s0=t("settings",Ea);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const qa=[["circle",{cx:"18",cy:"5",r:"3",key:"gq8acd"}],["circle",{cx:"6",cy:"12",r:"3",key:"w7nqdw"}],["circle",{cx:"18",cy:"19",r:"3",key:"1xt0gg"}],["line",{x1:"8.59",x2:"15.42",y1:"13.51",y2:"17.49",key:"47mynk"}],["line",{x1:"15.41",x2:"8.59",y1:"6.51",y2:"10.49",key:"1n3mei"}]],i0=t("share-2",qa);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const ja=[["path",{d:"M12 2v13",key:"1km8f5"}],["path",{d:"m16 6-4-4-4 4",key:"13yo43"}],["path",{d:"M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8",key:"1b2hhj"}]],h0=t("share",ja);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Ra=[["path",{d:"M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z",key:"oel41y"}],["path",{d:"M12 8v4",key:"1got3b"}],["path",{d:"M12 16h.01",key:"1drbdi"}]],d0=t("shield-alert",Ra);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Ta=[["path",{d:"M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z",key:"oel41y"}],["path",{d:"m9 12 2 2 4-4",key:"dzmm74"}]],y0=t("shield-check",Ta);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Sa=[["path",{d:"M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z",key:"oel41y"}],["path",{d:"m14.5 9.5-5 5",key:"17q4r4"}],["path",{d:"m9.5 9.5 5 5",key:"18nt4w"}]],l0=t("shield-x",Sa);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Oa=[["path",{d:"M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z",key:"oel41y"}]],u0=t("shield",Oa);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Ha=[["path",{d:"M16 10a4 4 0 0 1-8 0",key:"1ltviw"}],["path",{d:"M3.103 6.034h17.794",key:"awc11p"}],["path",{d:"M3.4 5.467a2 2 0 0 0-.4 1.2V20a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6.667a2 2 0 0 0-.4-1.2l-2-2.667A2 2 0 0 0 17 2H7a2 2 0 0 0-1.6.8z",key:"o988cm"}]],p0=t("shopping-bag",Ha);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const La=[["path",{d:"m18 14 4 4-4 4",key:"10pe0f"}],["path",{d:"m18 2 4 4-4 4",key:"pucp1d"}],["path",{d:"M2 18h1.973a4 4 0 0 0 3.3-1.7l5.454-8.6a4 4 0 0 1 3.3-1.7H22",key:"1ailkh"}],["path",{d:"M2 6h1.972a4 4 0 0 1 3.6 2.2",key:"km57vx"}],["path",{d:"M22 18h-6.041a4 4 0 0 1-3.3-1.8l-.359-.45",key:"os18l9"}]],k0=t("shuffle",La);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Va=[["path",{d:"M10 8h4",key:"1sr2af"}],["path",{d:"M12 21v-9",key:"17s77i"}],["path",{d:"M12 8V3",key:"13r4qs"}],["path",{d:"M17 16h4",key:"h1uq16"}],["path",{d:"M19 12V3",key:"o1uvq1"}],["path",{d:"M19 21v-5",key:"qua636"}],["path",{d:"M3 14h4",key:"bcjad9"}],["path",{d:"M5 10V3",key:"cb8scm"}],["path",{d:"M5 21v-7",key:"1w1uti"}]],f0=t("sliders-vertical",Va);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Pa=[["path",{d:"M10 5H3",key:"1qgfaw"}],["path",{d:"M12 19H3",key:"yhmn1j"}],["path",{d:"M14 3v4",key:"1sua03"}],["path",{d:"M16 17v4",key:"1q0r14"}],["path",{d:"M21 12h-9",key:"1o4lsq"}],["path",{d:"M21 19h-5",key:"1rlt1p"}],["path",{d:"M21 5h-7",key:"1oszz2"}],["path",{d:"M8 10v4",key:"tgpxqk"}],["path",{d:"M8 12H3",key:"a7s4jb"}]],_0=t("sliders-horizontal",Pa);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Da=[["rect",{width:"14",height:"20",x:"5",y:"2",rx:"2",ry:"2",key:"1yt0o3"}],["path",{d:"M12 18h.01",key:"mhygvu"}]],v0=t("smartphone",Da);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Ua=[["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}],["path",{d:"M8 14s1.5 2 4 2 4-2 4-2",key:"1y1vjs"}],["line",{x1:"9",x2:"9.01",y1:"9",y2:"9",key:"yxxnd0"}],["line",{x1:"15",x2:"15.01",y1:"9",y2:"9",key:"1p4y9e"}]],m0=t("smile",Ua);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Ya=[["path",{d:"M2 13a6 6 0 1 0 12 0 4 4 0 1 0-8 0 2 2 0 0 0 4 0",key:"hneq2s"}],["circle",{cx:"10",cy:"13",r:"8",key:"194lz3"}],["path",{d:"M2 21h12c4.4 0 8-3.6 8-8V7a2 2 0 1 0-4 0v6",key:"ixqyt7"}],["path",{d:"M18 3 19.1 5.2",key:"9tjm43"}],["path",{d:"M22 3 20.9 5.2",key:"j3odrs"}]],M0=t("snail",Ya);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Wa=[["path",{d:"M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z",key:"1s2grr"}],["path",{d:"M20 2v4",key:"1rf3ol"}],["path",{d:"M22 4h-4",key:"gwowj6"}],["circle",{cx:"4",cy:"20",r:"2",key:"6kqj1y"}]],g0=t("sparkles",Wa);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Ia=[["path",{d:"M21 10.656V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h12.344",key:"2acyp4"}],["path",{d:"m9 11 3 3L22 4",key:"1pflzl"}]],w0=t("square-check-big",Ia);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Ba=[["rect",{width:"18",height:"18",x:"3",y:"3",rx:"2",key:"afitv7"}]],b0=t("square",Ba);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Fa=[["path",{d:"M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z",key:"r04s7s"}]],x0=t("star",Fa);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Ga=[["circle",{cx:"12",cy:"12",r:"4",key:"4exip2"}],["path",{d:"M12 2v2",key:"tus03m"}],["path",{d:"M12 20v2",key:"1lh1kg"}],["path",{d:"m4.93 4.93 1.41 1.41",key:"149t6j"}],["path",{d:"m17.66 17.66 1.41 1.41",key:"ptbguv"}],["path",{d:"M2 12h2",key:"1t8f8n"}],["path",{d:"M20 12h2",key:"1q8mjw"}],["path",{d:"m6.34 17.66-1.41 1.41",key:"1m8zz5"}],["path",{d:"m19.07 4.93-1.41 1.41",key:"1shlcs"}]],N0=t("sun",Ga);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Qa=[["rect",{width:"16",height:"20",x:"4",y:"2",rx:"2",ry:"2",key:"76otgf"}],["line",{x1:"12",x2:"12.01",y1:"18",y2:"18",key:"1dp563"}]],$0=t("tablet",Qa);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Ka=[["path",{d:"M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z",key:"vktsd0"}],["circle",{cx:"7.5",cy:"7.5",r:".5",fill:"currentColor",key:"kqv944"}]],A0=t("tag",Ka);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Xa=[["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}],["circle",{cx:"12",cy:"12",r:"6",key:"1vlfrh"}],["circle",{cx:"12",cy:"12",r:"2",key:"1c9p78"}]],C0=t("target",Xa);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Za=[["path",{d:"M12 19h8",key:"baeox8"}],["path",{d:"m4 17 6-6-6-6",key:"1yngyt"}]],z0=t("terminal",Za);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Ja=[["path",{d:"M7 10v12",key:"1qc93n"}],["path",{d:"M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z",key:"emmmcr"}]],E0=t("thumbs-up",Ja);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const e2=[["path",{d:"M10 11v6",key:"nco0om"}],["path",{d:"M14 11v6",key:"outv1u"}],["path",{d:"M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6",key:"miytrc"}],["path",{d:"M3 6h18",key:"d0wm0j"}],["path",{d:"M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2",key:"e791ji"}]],q0=t("trash-2",e2);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const t2=[["path",{d:"M16 17h6v-6",key:"t6n2it"}],["path",{d:"m22 17-8.5-8.5-5 5L2 7",key:"x473p"}]],j0=t("trending-down",t2);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const a2=[["path",{d:"M16 7h6v6",key:"box55l"}],["path",{d:"m22 7-8.5 8.5-5-5L2 17",key:"1t1m79"}]],R0=t("trending-up",a2);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const o2=[["path",{d:"m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3",key:"wmoenq"}],["path",{d:"M12 9v4",key:"juzpu7"}],["path",{d:"M12 17h.01",key:"p32p05"}]],T0=t("triangle-alert",o2);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const n2=[["path",{d:"M10 14.66v1.626a2 2 0 0 1-.976 1.696A5 5 0 0 0 7 21.978",key:"1n3hpd"}],["path",{d:"M14 14.66v1.626a2 2 0 0 0 .976 1.696A5 5 0 0 1 17 21.978",key:"rfe1zi"}],["path",{d:"M18 9h1.5a1 1 0 0 0 0-5H18",key:"7xy6bh"}],["path",{d:"M4 22h16",key:"57wxv0"}],["path",{d:"M6 9a6 6 0 0 0 12 0V3a1 1 0 0 0-1-1H7a1 1 0 0 0-1 1z",key:"1mhfuq"}],["path",{d:"M6 9H4.5a1 1 0 0 1 0-5H6",key:"tex48p"}]],S0=t("trophy",n2);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const c2=[["path",{d:"M9 14 4 9l5-5",key:"102s5s"}],["path",{d:"M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5a5.5 5.5 0 0 1-5.5 5.5H11",key:"f3b9sd"}]],O0=t("undo-2",c2);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const r2=[["path",{d:"M12 3v12",key:"1x0j5s"}],["path",{d:"m17 8-5-5-5 5",key:"7q97r8"}],["path",{d:"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4",key:"ih7n3h"}]],H0=t("upload",r2);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const s2=[["path",{d:"m16 11 2 2 4-4",key:"9rsbq5"}],["path",{d:"M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2",key:"1yyitq"}],["circle",{cx:"9",cy:"7",r:"4",key:"nufk8"}]],L0=t("user-check",s2);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const i2=[["path",{d:"M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2",key:"1yyitq"}],["circle",{cx:"9",cy:"7",r:"4",key:"nufk8"}],["line",{x1:"19",x2:"19",y1:"8",y2:"14",key:"1bvyxn"}],["line",{x1:"22",x2:"16",y1:"11",y2:"11",key:"1shjgl"}]],V0=t("user-plus",i2);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const h2=[["path",{d:"M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2",key:"1yyitq"}],["circle",{cx:"9",cy:"7",r:"4",key:"nufk8"}],["line",{x1:"22",x2:"16",y1:"11",y2:"11",key:"1shjgl"}]],P0=t("user-minus",h2);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const d2=[["path",{d:"M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2",key:"1yyitq"}],["circle",{cx:"9",cy:"7",r:"4",key:"nufk8"}],["line",{x1:"17",x2:"22",y1:"8",y2:"13",key:"3nzzx3"}],["line",{x1:"22",x2:"17",y1:"8",y2:"13",key:"1swrse"}]],D0=t("user-x",d2);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const y2=[["path",{d:"M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2",key:"975kel"}],["circle",{cx:"12",cy:"7",r:"4",key:"17ys0d"}]],U0=t("user",y2);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const l2=[["path",{d:"M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2",key:"1yyitq"}],["path",{d:"M16 3.128a4 4 0 0 1 0 7.744",key:"16gr8j"}],["path",{d:"M22 21v-2a4 4 0 0 0-3-3.87",key:"kshegd"}],["circle",{cx:"9",cy:"7",r:"4",key:"nufk8"}]],Y0=t("users",l2);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const u2=[["path",{d:"M12 15v7",key:"t2xh3l"}],["path",{d:"M9 19h6",key:"456am0"}],["circle",{cx:"12",cy:"9",r:"6",key:"1nw4tq"}]],W0=t("venus",u2);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const p2=[["path",{d:"m16 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.87a.5.5 0 0 0-.752-.432L16 10.5",key:"ftymec"}],["rect",{x:"2",y:"6",width:"14",height:"12",rx:"2",key:"158x01"}]],I0=t("video",p2);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const k2=[["path",{d:"M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z",key:"uqj9uw"}],["path",{d:"M16 9a5 5 0 0 1 0 6",key:"1q6k2b"}],["path",{d:"M19.364 18.364a9 9 0 0 0 0-12.728",key:"ijwkga"}]],B0=t("volume-2",k2);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const f2=[["path",{d:"M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z",key:"uqj9uw"}],["line",{x1:"22",x2:"16",y1:"9",y2:"15",key:"1ewh16"}],["line",{x1:"16",x2:"22",y1:"9",y2:"15",key:"5ykzw1"}]],F0=t("volume-x",f2);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const _2=[["path",{d:"M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1",key:"18etb6"}],["path",{d:"M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4",key:"xoc0q4"}]],G0=t("wallet",_2);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const v2=[["path",{d:"M12 20h.01",key:"zekei9"}],["path",{d:"M8.5 16.429a5 5 0 0 1 7 0",key:"1bycff"}],["path",{d:"M5 12.859a10 10 0 0 1 5.17-2.69",key:"1dl1wf"}],["path",{d:"M19 12.859a10 10 0 0 0-2.007-1.523",key:"4k23kn"}],["path",{d:"M2 8.82a15 15 0 0 1 4.177-2.643",key:"1grhjp"}],["path",{d:"M22 8.82a15 15 0 0 0-11.288-3.764",key:"z3jwby"}],["path",{d:"m2 2 20 20",key:"1ooewy"}]],Q0=t("wifi-off",v2);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const m2=[["path",{d:"M12 20h.01",key:"zekei9"}],["path",{d:"M2 8.82a15 15 0 0 1 20 0",key:"dnpr2z"}],["path",{d:"M5 12.859a10 10 0 0 1 14 0",key:"1x1e6c"}],["path",{d:"M8.5 16.429a5 5 0 0 1 7 0",key:"1bycff"}]],K0=t("wifi",m2);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const M2=[["path",{d:"M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.106-3.105c.32-.322.863-.22.983.218a6 6 0 0 1-8.259 7.057l-7.91 7.91a1 1 0 0 1-2.999-3l7.91-7.91a6 6 0 0 1 7.057-8.259c.438.12.54.662.219.984z",key:"1ngwbx"}]],X0=t("wrench",M2);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const g2=[["path",{d:"M18 6 6 18",key:"1bl5f8"}],["path",{d:"m6 6 12 12",key:"d8bk6v"}]],Z0=t("x",g2);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const w2=[["path",{d:"M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z",key:"1xq2db"}]],J0=t("zap",w2);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const b2=[["circle",{cx:"11",cy:"11",r:"8",key:"4ej97u"}],["line",{x1:"21",x2:"16.65",y1:"21",y2:"16.65",key:"13gj7c"}],["line",{x1:"8",x2:"14",y1:"11",y2:"11",key:"durymu"}]],ec=t("zoom-out",b2);export{un as $,O2 as A,B2 as B,ro as C,c0 as D,Ho as E,Go as F,Jo as G,lo as H,rn as I,io as J,hn as K,n0 as L,qn as M,So as N,Io as O,Un as P,Qn as Q,N2 as R,y0 as S,q0 as T,Y0 as U,nn as V,Bn as W,Z0 as X,mo as Y,e0 as Z,qo as _,M as a,R2 as a$,X0 as a0,K0 as a1,z0 as a2,Nn as a3,_0 as a4,wo as a5,no as a6,ln as a7,Xo as a8,C2 as a9,Vo as aA,xn as aB,ec as aC,Dn as aD,mn as aE,H0 as aF,Lo as aG,t0 as aH,$n as aI,L0 as aJ,P0 as aK,yo as aL,_o as aM,J2 as aN,C0 as aO,G0 as aP,R0 as aQ,fn as aR,cn as aS,_n as aT,Kn as aU,In as aV,A0 as aW,Do as aX,eo as aY,d0 as aZ,ho as a_,en as aa,I0 as ab,wn as ac,Wn as ad,an as ae,Cn as af,To as ag,Zn as ah,sn as ai,V0 as aj,D2 as ak,U0 as al,J0 as am,x0 as an,S0 as ao,Eo as ap,on as aq,Fo as ar,Jn as as,Co as at,o0 as au,G2 as av,m0 as aw,vn as ax,Qo as ay,i0 as az,I1 as b,Sn as b$,Q2 as b0,An as b1,Ko as b2,T2 as b3,b0 as b4,oo as b5,co as b6,jo as b7,B0 as b8,F0 as b9,W2 as bA,On as bB,K2 as bC,z2 as bD,j0 as bE,l0 as bF,r0 as bG,I2 as bH,f0 as bI,gn as bJ,tn as bK,Yn as bL,Wo as bM,$o as bN,h0 as bO,xo as bP,H2 as bQ,Z2 as bR,Yo as bS,Mn as bT,E0 as bU,O0 as bV,zn as bW,M0 as bX,Bo as bY,pn as bZ,dn as b_,po as ba,uo as bb,S2 as bc,W0 as bd,bn as be,vo as bf,D0 as bg,Ln as bh,Hn as bi,Rn as bj,N0 as bk,P2 as bl,j2 as bm,V2 as bn,q2 as bo,kn as bp,Mo as bq,Gn as br,Y2 as bs,Pn as bt,En as bu,yn as bv,No as bw,E2 as bx,L2 as by,Q0 as bz,Xn as c,Po as c0,A2 as c1,Zo as c2,p0 as c3,Tn as c4,Ro as c5,Oo as c6,k0 as c7,Vn as c8,a0 as c9,X2 as ca,so as d,Ao as e,jn as f,Fn as g,v0 as h,g0 as i,$2 as j,u0 as k,$0 as l,ao as m,bo as n,T0 as o,fo as p,ko as q,W1 as r,F2 as s,to as t,zo as u,s0 as v,w0 as w,U2 as x,Uo as y,go as z};
