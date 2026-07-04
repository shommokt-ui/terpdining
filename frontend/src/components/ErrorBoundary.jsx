import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // surface to the console for debugging; do not crash the tree
    console.error('ErrorBoundary caught an error:', error, info?.componentStack);
  }

  handleReload = () => {
    this.setState({ error: null });
    window.location.reload();
  };

  handleGoHome = () => {
    this.setState({ error: null });
    window.location.assign('/');
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 text-center">
        <div className="text-6xl mb-4">🐢</div>
        <h1 className="text-2xl umd-hero-title text-umd-black mb-2">
          Something cracked the shell.
        </h1>
        <p className="text-umd-body text-sm max-w-md mb-6">
          TerpDining ran into an unexpected error. You can reload the page or head
          home to keep going.
        </p>
        <div className="flex gap-2">
          <button
            onClick={this.handleReload}
            className="px-4 py-2 rounded-lg text-sm font-semibold bg-umd-red text-white hover:bg-umd-red-dark transition-colors"
          >
            Reload
          </button>
          <button
            onClick={this.handleGoHome}
            className="px-4 py-2 rounded-lg text-sm font-semibold border border-umd-gray text-umd-black hover:border-umd-red hover:text-umd-red transition-colors"
          >
            Go home
          </button>
        </div>
        {import.meta.env.DEV && (
          <pre className="mt-6 max-w-2xl text-left text-xs text-umd-gray-dark bg-umd-gray-light/60 rounded-lg p-3 overflow-auto whitespace-pre-wrap">
            {String(this.state.error?.stack || this.state.error)}
          </pre>
        )}
      </div>
    );
  }
}
