/**
 * Root component — provider stack, routing, and layout composition.
 */
import { useState, useEffect } from 'react'
import { Router, Route, Switch } from 'wouter'
import { CycloProvider } from '@cyclo/react'
import { CONTRACT_ADDRESS, USDC_ADDRESS } from './constants/addresses'
import { MerchantProfileProvider } from './context/MerchantProfileContext'
import { ToastProvider } from './components/Toast'
import { Layout } from './components/Layout'
import { OverviewPage } from './pages/OverviewPage'
import { ConnectPage } from './pages/ConnectPage'
import { PlansPage } from './pages/PlansPage'
import { SubscribersPage } from './pages/SubscribersPage'
import { SettlementsPage } from './pages/SettlementsPage'
import { AnalyticsPage } from './pages/AnalyticsPage'
import { WebhooksPage } from './pages/WebhooksPage'
import { DevelopersPage } from './pages/DevelopersPage'
import { PastDuePage } from './pages/PastDuePage'
import { SubscribePage } from './pages/SubscribePage'
import { DemoPage } from './pages/DemoPage'
import { DocsPage } from './pages/DocsPage'
import { StatsPage } from './pages/StatsPage'
import { PortalPage } from './pages/PortalPage'
import { ArcEconomicsPage } from './pages/ArcEconomicsPage'
import { OnboardingPage } from './pages/OnboardingPage'
import { LandingPage } from './pages/LandingPage'
import { SplashScreen } from './components/SplashScreen'

/** Minimum time (ms) the splash stays visible, regardless of how fast the app loads. */
const SPLASH_MIN_MS = 800

function SubscribeRoute({ params }: { params: { planId: string } }) {
    const planId = BigInt(params.planId || '0')
    return <SubscribePage planId={planId} />
}

export default function App() {
    const [splashVisible, setSplashVisible] = useState(true)

    useEffect(() => {
        // Wait for both the minimum display time and the current microtask queue
        // (providers mounted) before revealing the app.
        const minimumDelay = new Promise<void>(resolve => setTimeout(resolve, SPLASH_MIN_MS))
        const appReady     = Promise.resolve()
        void Promise.all([minimumDelay, appReady]).then(() => setSplashVisible(false))
    }, [])

    return (
        <>
            <SplashScreen visible={splashVisible} />
            <CycloProvider
            contractAddress={CONTRACT_ADDRESS as `0x${string}`}
            usdcAddress={USDC_ADDRESS as `0x${string}`}
        >
            <MerchantProfileProvider>
                <ToastProvider>
                <Router>
                    <Switch>
                        {/* Public routes — no sidebar, no wallet required */}
                        <Route path="/" component={LandingPage} />
                        <Route path="/subscribe/:planId" component={SubscribeRoute} />
                        <Route path="/portal" component={PortalPage} />
                        <Route path="/arc-economics" component={ArcEconomicsPage} />
                        <Route path="/stats" component={StatsPage} />
                        <Route path="/demo" component={DemoPage} />
                        <Route path="/docs" component={DocsPage} />
                        <Route path="/onboarding" component={OnboardingPage} />

                        {/* Dashboard routes — all wrapped in Layout */}
                        <Route>
                            <Layout>
                                <Switch>
                                    <Route path="/dashboard" component={OverviewPage} />
                                    <Route path="/connect" component={ConnectPage} />
                                    <Route path="/plans" component={PlansPage} />
                                    <Route path="/past-due" component={PastDuePage} />
                                    <Route path="/subscribers" component={SubscribersPage} />
                                    <Route path="/settlements" component={SettlementsPage} />
                                    <Route path="/analytics" component={AnalyticsPage} />
                                    <Route path="/webhooks" component={WebhooksPage} />
                                    <Route path="/developers" component={DevelopersPage} />
                                </Switch>
                            </Layout>
                        </Route>
                    </Switch>
                </Router>
                </ToastProvider>
            </MerchantProfileProvider>
        </CycloProvider>
        </>
    )
}
