import React, { useState, useEffect } from 'react';
import BackButton from '../components/BackButton';
import { useSearchParams, Link } from 'react-router-dom';
import axios from 'axios';
import { Search, ChevronRight } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

function SearchResults() {
  const [searchParams] = useSearchParams();
  const query = searchParams.get('q');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (query) {
      setLoading(true);
      axios.get(`${API}/search?q=${encodeURIComponent(query)}`)
        .then(res => { setResults(res.data); setLoading(false); })
        .catch(() => setLoading(false));
    }
  }, [query]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 pt-3 sm:pt-4"><BackButton /></div>
        <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="px-5 py-8 pb-24">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
          <Search size={18} className="text-green-500" />
        </div>
        <div>
          <h1 className="font-bold text-lg text-gray-900" data-testid="search-results-title">
            "{query}"
          </h1>
          <p className="text-gray-500 text-sm">{results.length} result{results.length !== 1 ? 's' : ''} found</p>
        </div>
      </div>
      
      {results.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500 mb-4">No articles found for your search.</p>
          <Link to="/blog" className="text-green-500 font-medium">Browse all articles →</Link>
        </div>
      ) : (
        <div className="space-y-4">
          {results.map((blog, i) => (
            <Link 
              key={blog.id || blog.slug} 
              to={`/blog/${blog.slug}`}
              className="block"
              data-testid={`search-result-${i}`}
            >
              <article className="card-cg hover:shadow-md transition-shadow">
                <h2 className="font-bold text-lg text-gray-900 mb-2">
                  {blog.title}
                </h2>
                <p className="text-gray-500 text-sm line-clamp-2 mb-3">
                  {blog.content.substring(0, 150)}...
                </p>
                <div className="flex items-center gap-1 text-green-500 text-sm font-medium">
                  Read More <ChevronRight size={16} />
                </div>
              </article>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default SearchResults;
