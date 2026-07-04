import ReactMarkdown from 'react-markdown';

export default function ChatMessage({ role, content }) {
  const isUser = role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-3`}>
      {!isUser && (
        <div className="w-8 h-8 rounded-full bg-umd-gold flex items-center justify-center text-base mr-2 mt-1 shrink-0">
          🐢
        </div>
      )}
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
          isUser
            ? 'bg-umd-red text-white rounded-br-md'
            : 'umd-card text-umd-body rounded-bl-md'
        }`}
      >
        {isUser ? (
          <span className="whitespace-pre-wrap">{content}</span>
        ) : (
          <div className="chat-markdown">
            <ReactMarkdown
              components={{
                table: ({ children }) => (
                  <div className="overflow-x-auto my-2 rounded-lg border border-umd-gray">
                    <table className="w-full text-xs">{children}</table>
                  </div>
                ),
                thead: ({ children }) => (
                  <thead className="bg-umd-gray-light text-umd-gray-dark font-semibold">{children}</thead>
                ),
                th: ({ children }) => (
                  <th className="px-3 py-2 text-left whitespace-nowrap">{children}</th>
                ),
                td: ({ children }) => (
                  <td className="px-3 py-1.5 border-t border-umd-gray whitespace-nowrap">{children}</td>
                ),
                h3: ({ children }) => (
                  <h3 className="font-bold text-sm mt-3 mb-1">{children}</h3>
                ),
                ul: ({ children }) => (
                  <ul className="list-disc pl-4 my-1 space-y-0.5">{children}</ul>
                ),
                ol: ({ children }) => (
                  <ol className="list-decimal pl-4 my-1 space-y-0.5">{children}</ol>
                ),
                li: ({ children }) => (
                  <li className="text-sm">{children}</li>
                ),
                p: ({ children }) => (
                  <p className="my-1.5">{children}</p>
                ),
                strong: ({ children }) => (
                  <strong className="font-semibold">{children}</strong>
                ),
                code: ({ children }) => (
                  <code className="bg-umd-gray-light rounded px-1 py-0.5 text-xs font-mono">{children}</code>
                ),
              }}
            >
              {content}
            </ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}
