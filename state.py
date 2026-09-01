import re

with open('web/src/pages/Editor.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

state_vars = """  const [viewMode, setViewMode] = useState<'focus' | 'overview' | 'zen'>('focus');
  const [rightInspectorOpen, setRightInspectorOpen] = useState(true);
  const [activeInspectorTab, setActiveInspectorTab] = useState<'blocks' | 'assets' | 'styles' | 'presets'>('blocks');

  const [pickerBlockId, setPickerBlockId] = useState<string | null>(null);"""

content = re.sub(r'const \[pickerBlockId, setPickerBlockId\] = useState<string \| null>\(null\);', state_vars, content)

with open('web/src/pages/Editor.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
print("Added state vars")
