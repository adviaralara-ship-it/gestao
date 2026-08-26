import re

file_app = 'src/App.jsx'
with open(file_app, 'r', encoding='utf-8') as f:
    text_app = f.read()

if 'import AlphaAIChat' not in text_app:
    text_app = text_app.replace(
        "import Dashboard from './pages/Dashboard'",
        "import Dashboard from './pages/Dashboard'\nimport AlphaAIChat from './pages/AlphaAIChat'"
    )

if 'path="alpha-ai"' not in text_app:
    text_app = text_app.replace(
        '<Route index element={<Navigate to="dashboard" replace />} />',
        '<Route index element={<Navigate to="dashboard" replace />} />\n          <Route path="alpha-ai" element={<AuthorizedRoute module="alpha-ai"><AlphaAIChat /></AuthorizedRoute>} />'
    )

with open(file_app, 'w', encoding='utf-8') as f:
    f.write(text_app)
