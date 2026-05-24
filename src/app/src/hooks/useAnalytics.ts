import { useQuery } from '@tanstack/react-query'
import { useAccount, usePublicClient } from 'wagmi'
import { parseEventLogs } from 'viem'
import { SUBSCRIPTION_MANAGER_ABI } from '../constants/abis'
import { CONTRACT_ADDRESS, DEPLOY_BLOCK } from '../constants/addresses'
import { fromUsdcUnits } from '../utils/formatting'

export interface DailyRevenue {
    date:    string
    revenue: number
}

export interface PlanMetrics {
    planId:            bigint
    price:             number
    activeSubscribers: number
    mrr:               number
    totalRevenue:      number
}

export interface AnalyticsData {
    totalRevenue:      number
    mrr:               number
    activeSubscribers: number
    /** Total settled payment events across all plans owned by this merchant. */
    totalCharges:      number
    plans:             PlanMetrics[]
    dailyRevenue:      DailyRevenue[]
}

type Address = `0x${string}`

export function useAnalytics() {
    const { address }  = useAccount()
    const publicClient = usePublicClient()

    return useQuery<AnalyticsData>({
        queryKey: ['cyclo', 'analytics', address],
        enabled:  !!address && !!publicClient,
        queryFn:  async () => {
            const [planCreatedLogs, paymentChargedLogs, subCreatedLogs, subCancelledLogs] =
                await Promise.all([
                    publicClient!.getLogs({
                        address: CONTRACT_ADDRESS as Address,
                        event:   SUBSCRIPTION_MANAGER_ABI.find(e => e.type === 'event' && e.name === 'PlanCreated') as never,
                        fromBlock: DEPLOY_BLOCK,
                        toBlock:  'latest',
                    }),
                    publicClient!.getLogs({
                        address: CONTRACT_ADDRESS as Address,
                        event:   SUBSCRIPTION_MANAGER_ABI.find(e => e.type === 'event' && e.name === 'PaymentCharged') as never,
                        fromBlock: DEPLOY_BLOCK,
                        toBlock:  'latest',
                    }),
                    publicClient!.getLogs({
                        address: CONTRACT_ADDRESS as Address,
                        event:   SUBSCRIPTION_MANAGER_ABI.find(e => e.type === 'event' && e.name === 'SubscriptionCreated') as never,
                        fromBlock: DEPLOY_BLOCK,
                        toBlock:  'latest',
                    }),
                    publicClient!.getLogs({
                        address: CONTRACT_ADDRESS as Address,
                        event:   SUBSCRIPTION_MANAGER_ABI.find(e => e.type === 'event' && e.name === 'SubscriptionCancelled') as never,
                        fromBlock: DEPLOY_BLOCK,
                        toBlock:  'latest',
                    }),
                ])

            const parsed = {
                planCreated:    parseEventLogs({ abi: SUBSCRIPTION_MANAGER_ABI, logs: planCreatedLogs,    eventName: 'PlanCreated' }),
                paymentCharged: parseEventLogs({ abi: SUBSCRIPTION_MANAGER_ABI, logs: paymentChargedLogs, eventName: 'PaymentCharged' }),
                subCreated:     parseEventLogs({ abi: SUBSCRIPTION_MANAGER_ABI, logs: subCreatedLogs,     eventName: 'SubscriptionCreated' }),
                subCancelled:   parseEventLogs({ abi: SUBSCRIPTION_MANAGER_ABI, logs: subCancelledLogs,   eventName: 'SubscriptionCancelled' }),
            }

            const myPlanIds = new Set(
                parsed.planCreated
                    .filter(l => (l.args as { merchant?: string }).merchant?.toLowerCase() === address!.toLowerCase())
                    .map(l => (l.args as { planId: bigint }).planId)
            )

            if (myPlanIds.size === 0) {
                return { totalRevenue: 0, mrr: 0, activeSubscribers: 0, totalCharges: 0, plans: [], dailyRevenue: [] }
            }

            // Active subscribers per plan (subscribe events minus cancel events)
            const subscribersByPlan = new Map<string, Set<string>>()
            for (const planId of myPlanIds) subscribersByPlan.set(planId.toString(), new Set())

            for (const log of parsed.subCreated) {
                const { planId, subscriber } = log.args as { planId: bigint; subscriber: string }
                if (myPlanIds.has(planId)) subscribersByPlan.get(planId.toString())!.add(subscriber.toLowerCase())
            }
            for (const log of parsed.subCancelled) {
                const { planId, subscriber } = log.args as { planId: bigint; subscriber: string }
                if (myPlanIds.has(planId)) subscribersByPlan.get(planId.toString())?.delete(subscriber.toLowerCase())
            }

            const myPayments = parsed.paymentCharged.filter(l => myPlanIds.has((l.args as { planId: bigint }).planId))

            // Revenue per plan and daily totals
            const revenueByPlan = new Map<string, number>()
            const priceByPlan   = new Map<string, number>()
            for (const planId of myPlanIds) revenueByPlan.set(planId.toString(), 0)

            for (const log of parsed.planCreated) {
                const { planId, price } = log.args as { planId: bigint; price: bigint }
                priceByPlan.set(planId.toString(), fromUsdcUnits(price))
            }

            // Group all payments under today's date — block timestamps require extra
            // RPC calls per block and are unnecessary for the demo chart.
            const todayStr = new Date().toISOString().split('T')[0]
            const dailyMap = new Map<string, number>()
            for (const log of myPayments) {
                const { planId, amount } = log.args as { planId: bigint; amount: bigint }
                const usdcAmount = fromUsdcUnits(amount as bigint)
                revenueByPlan.set(planId.toString(), (revenueByPlan.get(planId.toString()) ?? 0) + usdcAmount)
                dailyMap.set(todayStr, (dailyMap.get(todayStr) ?? 0) + usdcAmount)
            }

            const plans: PlanMetrics[] = Array.from(myPlanIds).map(planId => {
                const key              = planId.toString()
                const activeSubscribers = subscribersByPlan.get(key)?.size ?? 0
                const price            = priceByPlan.get(key) ?? 0
                return {
                    planId,
                    price,
                    activeSubscribers,
                    mrr:          activeSubscribers * price,
                    totalRevenue: revenueByPlan.get(key) ?? 0,
                }
            })

            const dailyRevenue: DailyRevenue[] = Array.from(dailyMap.entries())
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([date, revenue]) => ({ date, revenue }))

            return {
                totalRevenue:      plans.reduce((s, p) => s + p.totalRevenue, 0),
                mrr:               plans.reduce((s, p) => s + p.mrr, 0),
                activeSubscribers: plans.reduce((s, p) => s + p.activeSubscribers, 0),
                totalCharges:      myPayments.length,
                plans,
                dailyRevenue,
            }
        },
        refetchInterval: 30_000,
    })
}
