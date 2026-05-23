"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  CycloProvider: () => CycloProvider,
  useCancelSubscription: () => useCancelSubscription,
  useCreatePlan: () => useCreatePlan,
  useCycloClient: () => useCycloClient,
  useIsSubscribed: () => useIsSubscribed,
  useMigratePlan: () => useMigratePlan,
  usePlan: () => usePlan,
  useSubscribe: () => useSubscribe,
  useSubscription: () => useSubscription
});
module.exports = __toCommonJS(index_exports);

// src/context.tsx
var import_react = require("react");
var import_wagmi = require("wagmi");
var import_sdk = require("@cyclo/sdk");
var import_jsx_runtime = require("react/jsx-runtime");
var CycloContext = (0, import_react.createContext)(null);
function CycloProvider({ contractAddress, usdcAddress, children }) {
  const publicClient = (0, import_wagmi.usePublicClient)();
  const { data: walletClient } = (0, import_wagmi.useWalletClient)();
  const clientRef = (0, import_react.useRef)(null);
  if (!publicClient) return null;
  if (!clientRef.current) {
    clientRef.current = new import_sdk.CycloClient({
      contractAddress,
      usdcAddress,
      publicClient,
      walletClient: walletClient ?? void 0
    });
  } else {
    if (walletClient) clientRef.current.setWalletClient(walletClient);
  }
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CycloContext.Provider, { value: clientRef.current, children });
}
function useCycloClient() {
  const client = (0, import_react.useContext)(CycloContext);
  if (!client) throw new Error("useCycloClient must be used inside CycloProvider");
  return client;
}

// src/hooks/usePlan.ts
var import_react_query = require("@tanstack/react-query");
function usePlan(planId) {
  const cyclo = useCycloClient();
  return (0, import_react_query.useQuery)({
    queryKey: ["cyclo", "plan", planId?.toString()],
    queryFn: () => cyclo.getPlan(planId),
    enabled: planId !== void 0
  });
}

// src/hooks/useSubscription.ts
var import_react_query2 = require("@tanstack/react-query");
function useSubscription(subscriber, planId) {
  const cyclo = useCycloClient();
  return (0, import_react_query2.useQuery)({
    queryKey: ["cyclo", "subscription", subscriber, planId?.toString()],
    queryFn: () => cyclo.getSubscription(subscriber, planId),
    enabled: !!subscriber && planId !== void 0
  });
}

// src/hooks/useCreatePlan.ts
var import_react_query3 = require("@tanstack/react-query");
function useCreatePlan() {
  const cyclo = useCycloClient();
  const queryClient = (0, import_react_query3.useQueryClient)();
  return (0, import_react_query3.useMutation)({
    mutationFn: (params) => cyclo.createPlan(params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cyclo", "plans"] });
    }
  });
}

// src/hooks/useSubscribe.ts
var import_react_query4 = require("@tanstack/react-query");
function useSubscribe() {
  const cyclo = useCycloClient();
  const queryClient = (0, import_react_query4.useQueryClient)();
  return (0, import_react_query4.useMutation)({
    mutationFn: (planId) => cyclo.subscribe(planId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cyclo", "subscription"] });
    }
  });
}

// src/hooks/useCancelSubscription.ts
var import_react_query5 = require("@tanstack/react-query");
function useCancelSubscription() {
  const cyclo = useCycloClient();
  const queryClient = (0, import_react_query5.useQueryClient)();
  return (0, import_react_query5.useMutation)({
    mutationFn: (planId) => cyclo.cancelSubscription(planId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cyclo", "subscription"] });
    }
  });
}

// src/hooks/useMigratePlan.ts
var import_react_query6 = require("@tanstack/react-query");
function useMigratePlan() {
  const cyclo = useCycloClient();
  const queryClient = (0, import_react_query6.useQueryClient)();
  return (0, import_react_query6.useMutation)({
    mutationFn: ({ currentPlanId, newPlanId }) => cyclo.migratePlan(currentPlanId, newPlanId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cyclo"] });
    }
  });
}

// src/hooks/useIsSubscribed.ts
var import_react2 = require("react");
var import_react_query7 = require("@tanstack/react-query");
var DISABLED_RESULT = {
  isSubscribed: false,
  tokenId: null,
  isLoading: false,
  error: null
};
function useIsSubscribed(subscriber, planId) {
  const cyclo = useCycloClient();
  const queryClient = (0, import_react_query7.useQueryClient)();
  const enabled = !!subscriber && planId !== void 0;
  const { data, isLoading, error } = (0, import_react_query7.useQuery)({
    queryKey: ["cyclo", "isSubscribed", subscriber, planId?.toString()],
    queryFn: async () => {
      const [isSubscribed, tokenId] = await Promise.all([
        cyclo.isSubscribed(subscriber, planId),
        cyclo.getSubscriberTokenId(subscriber, planId)
      ]);
      return { isSubscribed, tokenId };
    },
    enabled
  });
  (0, import_react2.useEffect)(() => {
    if (!subscriber || planId === void 0) return;
    const sub = subscriber;
    const plan = planId;
    const handleEvent = (args) => {
      if (args.subscriber?.toLowerCase() === sub.toLowerCase() && args.planId === plan) {
        queryClient.invalidateQueries({
          queryKey: ["cyclo", "isSubscribed", sub, plan.toString()]
        });
      }
    };
    const unsubCreated = cyclo.on("SubscriptionCreated", handleEvent);
    const unsubCancelled = cyclo.on("SubscriptionCancelled", handleEvent);
    return () => {
      unsubCreated();
      unsubCancelled();
    };
  }, [subscriber, planId, cyclo, queryClient]);
  if (!enabled) return DISABLED_RESULT;
  return {
    isSubscribed: data?.isSubscribed ?? false,
    tokenId: data?.tokenId ?? null,
    isLoading,
    error
  };
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  CycloProvider,
  useCancelSubscription,
  useCreatePlan,
  useCycloClient,
  useIsSubscribed,
  useMigratePlan,
  usePlan,
  useSubscribe,
  useSubscription
});
