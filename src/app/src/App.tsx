/**
 * Root component — provider stack, routing, and layout composition.
 */
import { Router, Route, Switch } from 'wouter'
import { CycloProvider } from '@cyclo/react'
import { CONTRACT_ADDRESS, USDC_ADDRESS } from './constants/addresses'
import { MerchantProfileProvider } from './context/MerchantProfileContext'
import { Layout } from './components/Layout'
import { OverviewPage } from './pages/OverviewPage'
import { ConnectPage } from './pages/ConnectPage'
import { PlansPage } from './pages/PlansPage'
import { SubscribersPage } from './pages/SubscribersPage'
import { SettlementsPage } from './pages/SettlementsPage'
import { AnalyticsPage } from './pages/AnalyticsPage'
import { WebhooksPage } from './pages/WebhooksPage'
import { DevelopersPage } from './pages/DevelopersPage'
import { SubscribePage } from './pages/SubscribePage'
import { DemoPage } from './pages/DemoPage'
import { DocsPage } from './pages/DocsPage'
import { StatsPage } from './pages/StatsPage'
import { PortalPage } from './pages/PortalPage'
import { ArcEconomicsPage } from './pages/ArcEconomicsPage'
import { OnboardingPage } from './pages/OnboardingPage'

function SubscribeRoute({ params }: { params: { planId: string } }) {
    const planId = BigInt(params.planId || '0')
    return <SubscribePage planId={planId} />
}

export default function App() {
    return (
        <CycloProvider
            contractAddress={CONTRACT_ADDRESS as `0x${string}`}
            usdcAddress={USDC_ADDRESS as `0x${string}`}
        >
            <MerchantProfileProvider>
                <Router>
                    <Switch>
                        {/* Full-page routes — no sidebar */}
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
                                    <Route path="/" component={OverviewPage} />
                                    <Route path="/connect" component={ConnectPage} />
                                    <Route path="/plans" component={PlansPage} />
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
            </MerchantProfileProvider>
        </CycloProvider>
    )
}
