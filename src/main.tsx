import { render } from 'preact'
import { ModelProvider } from './ui/model'
import { RouterProvider } from './ui/router'
import { Shell } from './ui/shell'
import './styles.css'

const root = document.getElementById('app')
if (root) {
  render(
    <ModelProvider>
      <RouterProvider>
        <Shell />
      </RouterProvider>
    </ModelProvider>,
    root,
  )
}
