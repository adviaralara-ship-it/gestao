import os

file_path = 'src/pages/AlphaAIChat.jsx'
with open(file_path, 'r', encoding='utf-8') as f:
    text = f.read()

split_str = 'if (!user) return null'
parts = text.split(split_str)
if len(parts) > 1:
    before = parts[0] + split_str
    
    new_render = """

  return (
    <div className="h-full flex flex-col bg-gray-50 rounded-2xl shadow-sm border border-cream-200 overflow-hidden animate-fade-in">
      {/* Header */}
      <div className="bg-brand-700 text-white p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center relative">
            <Bot size={26} className="text-white"/>
            <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-400 border-2 border-brand-700 rounded-full"></span>
          </div>
          <div>
            <h3 className="font-bold text-lg">Alpha AI</h3>
            <p className="text-xs text-brand-100">Seu Concierge Virtual Inteligente</p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 flex flex-col gap-4 custom-scrollbar">
        {messages.map((m, idx) => (
          <RenderMessage key={idx} message={m} user={user} />
        ))}
        {loading && (
          <div className="mr-auto bg-white border border-cream-200 rounded-2xl rounded-bl-none p-4 shadow-sm flex gap-1">
            <span className="w-2.5 h-2.5 bg-brand-400 rounded-full animate-bounce"></span>
            <span className="w-2.5 h-2.5 bg-brand-400 rounded-full animate-bounce" style={{animationDelay:'0.2s'}}></span>
            <span className="w-2.5 h-2.5 bg-brand-400 rounded-full animate-bounce" style={{animationDelay:'0.4s'}}></span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 bg-white border-t border-cream-200">
        <div className="relative flex items-center max-w-4xl mx-auto">
          <input 
            className="w-full bg-gray-100 border-none rounded-full pl-6 pr-14 py-4 text-sm md:text-base focus:ring-2 focus:ring-brand-500 transition-all outline-none"
            placeholder="Pergunte ao Alpha AI..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
          />
          <button 
            onClick={handleSend}
            disabled={!input.trim() || loading}
            className="absolute right-2 w-10 h-10 bg-brand-600 rounded-full flex items-center justify-center text-white disabled:bg-gray-300 disabled:text-gray-500 transition-colors hover:bg-brand-700"
          >
            <Send size={18} />
          </button>
        </div>
        <p className="text-[10px] text-center text-gray-400 mt-2">A IA pode cometer erros. Verifique informações importantes.</p>
      </div>
    </div>
  )
}
"""
    text = before + new_render

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(text)
