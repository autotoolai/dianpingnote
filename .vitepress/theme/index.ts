import DefaultTheme from 'vitepress/theme'
import type { Theme } from 'vitepress'
import './custom.css'
import HomeHero from './components/HomeHero.vue'
import FeatureCards from './components/FeatureCards.vue'
import WorkflowStrip from './components/WorkflowStrip.vue'
import CtaBand from './components/CtaBand.vue'
import MediaFigure from './components/MediaFigure.vue'
import DeviceFrame from './components/DeviceFrame.vue'
import DownloadGate from './components/DownloadGate.vue'
import CompareTable from './components/CompareTable.vue'
import StatRow from './components/StatRow.vue'
import ContactWechat from './components/ContactWechat.vue'

const theme: Theme = {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('HomeHero', HomeHero)
    app.component('FeatureCards', FeatureCards)
    app.component('WorkflowStrip', WorkflowStrip)
    app.component('CtaBand', CtaBand)
    app.component('MediaFigure', MediaFigure)
    app.component('DeviceFrame', DeviceFrame)
    app.component('DownloadGate', DownloadGate)
    app.component('CompareTable', CompareTable)
    app.component('StatRow', StatRow)
    app.component('ContactWechat', ContactWechat)
  },
}

export default theme