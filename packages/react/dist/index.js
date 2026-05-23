// src/context.tsx
import { createContext, useContext, useRef } from "react";
import { usePublicClient, useWalletClient } from "wagmi";
import { CycloClient } from "@cyclo/sdk";
import { jsx } from "react/jsx-runtime";
var CycloContext = createContext(null);
function CycloProvider({ contractAddress, usdcAddress, children }) {
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const clientRef = useRef(null);
  if (!publicClient) return null;
  if (!clientRef.current) {
    clientRef.current = new CycloClient({
      contractAddress,
      usdcAddress,
      publicClient,
      walletClient: walletClient ?? void 0
    });
  } else {
    if (walletClient) clientRef.current.setWalletClient(walletClient);
  }
  return /* @__PURE__ */ jsx(CycloContext.Provider, { value: clientRef.current, children });
}
function useCycloClient() {
  const client = useContext(CycloContext);
  if (!client) throw new Error("useCycloClient must be used inside CycloProvider");
  return client;
}

// src/hooks/usePlan.ts
import { useQuery } from "@tanstack/react-query";
function usePlan(planId) {
  const cyclo = useCycloClient();
  return useQuery({
    queryKey: ["cyclo", "plan", planId?.toString()],
    queryFn: () => cyclo.getPlan(planId),
    enabled: planId !== void 0
  });
}

// src/hooks/useSubscription.ts
import { useQuery as useQuery2 } from "@tanstack/react-query";
function useSubscription(subscriber, planId) {
  const cyclo = useCycloClient();
  return useQuery2({
    queryKey: ["cyclo", "subscription", subscriber, planId?.toString()],
    queryFn: () => cyclo.getSubscription(subscriber, planId),
    enabled: !!subscriber && planId !== void 0
  });
}

// src/hooks/useCreatePlan.ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
function useCreatePlan() {
  const cyclo = useCycloClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params) => cyclo.createPlan(params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cyclo", "plans"] });
    }
  });
}

// src/hooks/useSubscribe.ts
import { useMutation as useMutation2, useQueryClient as useQueryClient2 } from "@tanstack/react-query";
function useSubscribe() {
  const cyclo = useCycloClient();
  const queryClient = useQueryClient2();
  return useMutation2({
    mutationFn: (planId) => cyclo.subscribe(planId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cyclo", "subscription"] });
    }
  });
}

// src/hooks/useCancelSubscription.ts
import { useMutation as useMutation3, useQueryClient as useQueryClient3 } from "@tanstack/react-query";
function useCancelSubscription() {
  const cyclo = useCycloClient();
  const queryClient = useQueryClient3();
  return useMutation3({
    mutationFn: (planId) => cyclo.cancelSubscription(planId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cyclo", "subscription"] });
    }
  });
}

// src/hooks/useMigratePlan.ts
import { useMutation as useMutation4, useQueryClient as useQueryClient4 } from "@tanstack/react-query";
function useMigratePlan() {
  const cyclo = useCycloClient();
  const queryClient = useQueryClient4();
  return useMutation4({
    mutationFn: ({ currentPlanId, newPlanId }) => cyclo.migratePlan(currentPlanId, newPlanId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cyclo"] });
    }
  });
}

// src/hooks/useIsSubscribed.ts
import { useEffect } from "react";
import { useQuery as useQuery3, useQueryClient as useQueryClient5 } from "@tanstack/react-query";
var DISABLED_RESULT = {
  isSubscribed: false,
  tokenId: null,
  isLoading: false,
  error: null
};
function useIsSubscribed(subscriber, planId) {
  const cyclo = useCycloClient();
  const queryClient = useQueryClient5();
  const enabled = !!subscriber && planId !== void 0;
  const { data, isLoading, error } = useQuery3({
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
  useEffect(() => {
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
export {
  CycloProvider,
  useCancelSubscription,
  useCreatePlan,
  useCycloClient,
  useIsSubscribed,
  useMigratePlan,
  usePlan,
  useSubscribe,
  useSubscription
};
