import { useState, useEffect, useRef } from 'react'

const STORAGE_KEY = 'reading-journal-books'
const API_URL = '/api/books'

// Fetch book cover from Open Library API
async function fetchBookCover(title, author) {
  try {
    const query = encodeURIComponent(`${title} ${author}`)
    const res = await fetch(`https://openlibrary.org/search.json?q=${query}&limit=1`)
    if (res.ok) {
      const data = await res.json()
      if (data.docs && data.docs.length > 0) {
        const book = data.docs[0]
        if (book.cover_i) {
          return `https://covers.openlibrary.org/b/id/${book.cover_i}-M.jpg`
        }
      }
    }
  } catch {
    // Silently fail - cover is optional
  }
  return null
}

function App() {
  const [books, setBooks] = useState([])
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingBook, setEditingBook] = useState(null)
  const [editingBookDetails, setEditingBookDetails] = useState(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const isInitialLoad = useRef(true)

  // Load books from API on mount
  useEffect(() => {
    async function loadBooks() {
      try {
        const res = await fetch(API_URL)
        if (res.ok) {
          const data = await res.json()
          setBooks(data)
        } else {
          // Fallback to localStorage
          const saved = localStorage.getItem(STORAGE_KEY)
          if (saved) setBooks(JSON.parse(saved))
        }
      } catch {
        // Fallback to localStorage for local dev
        const saved = localStorage.getItem(STORAGE_KEY)
        if (saved) setBooks(JSON.parse(saved))
      } finally {
        setLoading(false)
        isInitialLoad.current = false
      }
    }
    loadBooks()
  }, [])

  // Fetch covers for books that don't have them
  useEffect(() => {
    if (loading) return

    const booksWithoutCovers = books.filter(b => !b.coverUrl)
    if (booksWithoutCovers.length === 0) return

    // Fetch covers one at a time to avoid rate limiting
    async function fetchCovers() {
      for (const book of booksWithoutCovers) {
        const coverUrl = await fetchBookCover(book.title, book.author)
        if (coverUrl) {
          setBooks(prev => prev.map(b => b.id === book.id ? { ...b, coverUrl } : b))
        }
      }
    }
    fetchCovers()
  }, [loading]) // Only run once after initial load

  // Save books to API when changed
  useEffect(() => {
    if (isInitialLoad.current) return

    // Always save to localStorage as backup
    localStorage.setItem(STORAGE_KEY, JSON.stringify(books))

    // Save to API
    async function saveBooks() {
      setSyncing(true)
      try {
        await fetch(API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(books)
        })
      } catch {
        // Silently fail - localStorage backup exists
      } finally {
        setSyncing(false)
      }
    }
    saveBooks()
  }, [books])

  const addBook = async (book) => {
    const newBook = { ...book, id: Date.now(), status: 'tbr', coverUrl: null }
    setBooks([...books, newBook])
    setShowAddForm(false)

    // Fetch cover in background
    const coverUrl = await fetchBookCover(book.title, book.author)
    if (coverUrl) {
      setBooks(prev => prev.map(b => b.id === newBook.id ? { ...b, coverUrl } : b))
    }
  }

  const updateBookDetails = async (id, updates) => {
    setBooks(books.map(book =>
      book.id === id ? { ...book, ...updates, coverUrl: null } : book
    ))
    setEditingBookDetails(null)

    // Fetch new cover if title or author changed
    const book = books.find(b => b.id === id)
    const newTitle = updates.title || book.title
    const newAuthor = updates.author || book.author
    const coverUrl = await fetchBookCover(newTitle, newAuthor)
    if (coverUrl) {
      setBooks(prev => prev.map(b => b.id === id ? { ...b, coverUrl } : b))
    }
  }

  const moveToFinished = (id) => {
    setBooks(books.map(book =>
      book.id === id ? { ...book, status: 'finished', rating: 0, notes: '' } : book
    ))
  }

  const moveToTBR = (id) => {
    setBooks(books.map(book =>
      book.id === id ? { ...book, status: 'tbr', rating: undefined, notes: undefined } : book
    ))
  }

  const updateBook = (id, updates) => {
    setBooks(books.map(book =>
      book.id === id ? { ...book, ...updates } : book
    ))
  }

  const deleteBook = (id) => {
    setBooks(books.filter(book => book.id !== id))
  }

  const tbrBooks = books.filter(book => book.status === 'tbr')
  const finishedBooks = books.filter(book => book.status === 'finished')

  if (loading) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <div className="text-charcoal-light text-lg">Loading your library...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-cream">
      <header className="bg-charcoal text-cream py-8 px-4 shadow-lg">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl md:text-4xl font-light tracking-wide text-center">
            Personal Library
          </h1>
          <p className="text-cream-dark text-center mt-2 text-sm tracking-widest uppercase">
            Reading Journal
            {syncing && <span className="ml-2 text-xs opacity-70">(syncing...)</span>}
          </p>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <button
          onClick={() => setShowAddForm(true)}
          className="w-full md:w-auto mb-8 px-6 py-3 bg-charcoal text-cream rounded hover:bg-charcoal-light transition-colors duration-200 flex items-center justify-center gap-2"
        >
          <span className="text-xl">+</span>
          <span>Add New Book</span>
        </button>

        {showAddForm && (
          <AddBookForm
            onAdd={addBook}
            onCancel={() => setShowAddForm(false)}
          />
        )}

        {editingBookDetails && (
          <EditBookForm
            book={editingBookDetails}
            onSave={(updates) => updateBookDetails(editingBookDetails.id, updates)}
            onCancel={() => setEditingBookDetails(null)}
          />
        )}

        <section className="mb-12">
          <h2 className="text-2xl font-light text-charcoal border-b-2 border-charcoal pb-2 mb-6 flex items-center gap-3">
            <span className="text-accent">TBR</span>
            <span className="text-charcoal-lighter text-base font-normal">To Be Read</span>
            <span className="ml-auto text-base text-charcoal-lighter">({tbrBooks.length})</span>
          </h2>

          {tbrBooks.length === 0 ? (
            <p className="text-charcoal-lighter italic text-center py-8">
              Your reading list is empty. Add some books to get started.
            </p>
          ) : (
            <div className="grid gap-4">
              {tbrBooks.map(book => (
                <TBRBookCard
                  key={book.id}
                  book={book}
                  onMoveToFinished={() => moveToFinished(book.id)}
                  onDelete={() => deleteBook(book.id)}
                  onEdit={() => setEditingBookDetails(book)}
                />
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="text-2xl font-light text-charcoal border-b-2 border-charcoal pb-2 mb-6 flex items-center gap-3">
            <span className="text-accent">Finished</span>
            <span className="text-charcoal-lighter text-base font-normal">Completed Reads</span>
            <span className="ml-auto text-base text-charcoal-lighter">({finishedBooks.length})</span>
          </h2>

          {finishedBooks.length === 0 ? (
            <p className="text-charcoal-lighter italic text-center py-8">
              No finished books yet. Start reading!
            </p>
          ) : (
            <div className="grid gap-4">
              {finishedBooks.map(book => (
                <FinishedBookCard
                  key={book.id}
                  book={book}
                  onUpdate={(updates) => updateBook(book.id, updates)}
                  onMoveToTBR={() => moveToTBR(book.id)}
                  onDelete={() => deleteBook(book.id)}
                  isEditing={editingBook === book.id}
                  onEditToggle={() => setEditingBook(editingBook === book.id ? null : book.id)}
                  onEditDetails={() => setEditingBookDetails(book)}
                />
              ))}
            </div>
          )}
        </section>
      </main>

      <footer className="bg-cream-dark text-charcoal-lighter text-center py-6 mt-12">
        <p className="text-sm">Your Personal Reading Journey</p>
      </footer>
    </div>
  )
}

function AddBookForm({ onAdd, onCancel }) {
  const [title, setTitle] = useState('')
  const [author, setAuthor] = useState('')
  const [readLevel, setReadLevel] = useState('moderate')

  const handleSubmit = (e) => {
    e.preventDefault()
    if (title.trim() && author.trim()) {
      onAdd({ title: title.trim(), author: author.trim(), readLevel })
    }
  }

  return (
    <div className="fixed inset-0 bg-charcoal/50 flex items-center justify-center p-4 z-50">
      <div className="bg-cream rounded-lg shadow-xl max-w-md w-full p-6">
        <h3 className="text-xl font-light text-charcoal mb-6 border-b border-charcoal-lighter pb-2">
          Add New Book
        </h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-charcoal-light mb-1">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-2 border border-charcoal-lighter rounded bg-cream-dark focus:outline-none focus:border-charcoal transition-colors"
              placeholder="Book title"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm text-charcoal-light mb-1">Author</label>
            <input
              type="text"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              className="w-full px-4 py-2 border border-charcoal-lighter rounded bg-cream-dark focus:outline-none focus:border-charcoal transition-colors"
              placeholder="Author name"
            />
          </div>
          <div>
            <label className="block text-sm text-charcoal-light mb-1">Read Level</label>
            <select
              value={readLevel}
              onChange={(e) => setReadLevel(e.target.value)}
              className="w-full px-4 py-2 border border-charcoal-lighter rounded bg-cream-dark focus:outline-none focus:border-charcoal transition-colors"
            >
              <option value="easy">Easy / Relaxing</option>
              <option value="moderate">Moderate</option>
              <option value="academic">Academic / Dense</option>
            </select>
          </div>
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 px-4 py-2 border border-charcoal-lighter text-charcoal-light rounded hover:bg-cream-dark transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-charcoal text-cream rounded hover:bg-charcoal-light transition-colors"
            >
              Add Book
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function EditBookForm({ book, onSave, onCancel }) {
  const [title, setTitle] = useState(book.title)
  const [author, setAuthor] = useState(book.author)
  const [readLevel, setReadLevel] = useState(book.readLevel)

  const handleSubmit = (e) => {
    e.preventDefault()
    if (title.trim() && author.trim()) {
      onSave({ title: title.trim(), author: author.trim(), readLevel })
    }
  }

  return (
    <div className="fixed inset-0 bg-charcoal/50 flex items-center justify-center p-4 z-50">
      <div className="bg-cream rounded-lg shadow-xl max-w-md w-full p-6">
        <h3 className="text-xl font-light text-charcoal mb-6 border-b border-charcoal-lighter pb-2">
          Edit Book
        </h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-charcoal-light mb-1">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-2 border border-charcoal-lighter rounded bg-cream-dark focus:outline-none focus:border-charcoal transition-colors"
              placeholder="Book title"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm text-charcoal-light mb-1">Author</label>
            <input
              type="text"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              className="w-full px-4 py-2 border border-charcoal-lighter rounded bg-cream-dark focus:outline-none focus:border-charcoal transition-colors"
              placeholder="Author name"
            />
          </div>
          <div>
            <label className="block text-sm text-charcoal-light mb-1">Read Level</label>
            <select
              value={readLevel}
              onChange={(e) => setReadLevel(e.target.value)}
              className="w-full px-4 py-2 border border-charcoal-lighter rounded bg-cream-dark focus:outline-none focus:border-charcoal transition-colors"
            >
              <option value="easy">Easy / Relaxing</option>
              <option value="moderate">Moderate</option>
              <option value="academic">Academic / Dense</option>
            </select>
          </div>
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 px-4 py-2 border border-charcoal-lighter text-charcoal-light rounded hover:bg-cream-dark transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-charcoal text-cream rounded hover:bg-charcoal-light transition-colors"
            >
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function TBRBookCard({ book, onMoveToFinished, onDelete, onEdit }) {
  const levelLabels = {
    easy: 'Easy / Relaxing',
    moderate: 'Moderate',
    academic: 'Academic / Dense'
  }

  const levelColors = {
    easy: 'bg-green-100 text-green-800',
    moderate: 'bg-amber-100 text-amber-800',
    academic: 'bg-red-100 text-red-800'
  }

  return (
    <div className="bg-cream-dark rounded-lg p-5 shadow-sm hover:shadow-md transition-shadow border-l-4 border-accent">
      <div className="flex gap-4">
        {/* Book Cover */}
        <div className="flex-shrink-0 w-16 h-24 bg-cream rounded overflow-hidden border border-charcoal-lighter">
          {book.coverUrl ? (
            <img
              src={book.coverUrl}
              alt={`Cover of ${book.title}`}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-charcoal-lighter">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
          )}
        </div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 flex-1">
          <div className="flex-1">
            <h3 className="text-lg font-medium text-charcoal">{book.title}</h3>
            <p className="text-charcoal-light text-sm mt-1">by {book.author}</p>
            <span className={`inline-block mt-2 px-3 py-1 rounded-full text-xs ${levelColors[book.readLevel]}`}>
              {levelLabels[book.readLevel]}
            </span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={onEdit}
              className="px-3 py-2 text-charcoal-lighter hover:text-accent transition-colors"
              title="Edit book details"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
              </svg>
            </button>
            <button
              onClick={onMoveToFinished}
              className="px-4 py-2 bg-accent text-cream rounded hover:bg-accent-light transition-colors text-sm"
            >
              Mark Finished
            </button>
            <button
              onClick={onDelete}
              className="px-3 py-2 text-charcoal-lighter hover:text-red-600 transition-colors"
              title="Delete book"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function FinishedBookCard({ book, onUpdate, onMoveToTBR, onDelete, isEditing, onEditToggle, onEditDetails }) {
  const [notes, setNotes] = useState(book.notes || '')
  const [rating, setRating] = useState(book.rating || 0)

  useEffect(() => {
    setNotes(book.notes || '')
    setRating(book.rating || 0)
  }, [book.notes, book.rating])

  const handleSave = () => {
    onUpdate({ notes, rating })
    onEditToggle()
  }

  const levelLabels = {
    easy: 'Easy / Relaxing',
    moderate: 'Moderate',
    academic: 'Academic / Dense'
  }

  return (
    <div className="bg-cream-dark rounded-lg p-5 shadow-sm hover:shadow-md transition-shadow border-l-4 border-charcoal">
      <div className="flex flex-col gap-4">
        <div className="flex gap-4">
          {/* Book Cover */}
          <div className="flex-shrink-0 w-16 h-24 bg-cream rounded overflow-hidden border border-charcoal-lighter">
            {book.coverUrl ? (
              <img
                src={book.coverUrl}
                alt={`Cover of ${book.title}`}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-charcoal-lighter">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
            )}
          </div>

          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 flex-1">
            <div className="flex-1">
              <h3 className="text-lg font-medium text-charcoal">{book.title}</h3>
              <p className="text-charcoal-light text-sm mt-1">by {book.author}</p>
              <p className="text-charcoal-lighter text-xs mt-1">{levelLabels[book.readLevel]}</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={onEditDetails}
                className="px-3 py-2 text-charcoal-lighter hover:text-accent transition-colors"
                title="Edit book details"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                </svg>
              </button>
              <button
                onClick={onEditToggle}
                className="px-4 py-2 border border-charcoal-lighter text-charcoal-light rounded hover:bg-cream transition-colors text-sm"
              >
                {isEditing ? 'Cancel' : 'Edit Journal'}
              </button>
              <button
                onClick={onMoveToTBR}
                className="px-3 py-2 text-charcoal-lighter hover:text-accent transition-colors"
                title="Move back to TBR"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M9.707 14.707a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 1.414L7.414 9H15a1 1 0 110 2H7.414l2.293 2.293a1 1 0 010 1.414z" clipRule="evenodd" />
                </svg>
              </button>
              <button
                onClick={onDelete}
                className="px-3 py-2 text-charcoal-lighter hover:text-red-600 transition-colors"
                title="Delete book"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <span className="text-sm text-charcoal-light mr-2">Rating:</span>
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              onClick={() => {
                setRating(star)
                if (!isEditing) onUpdate({ rating: star })
              }}
              className={`text-2xl transition-colors ${
                star <= (isEditing ? rating : book.rating)
                  ? 'text-amber-500'
                  : 'text-charcoal-lighter hover:text-amber-300'
              }`}
            >
              {star <= (isEditing ? rating : book.rating) ? '★' : '☆'}
            </button>
          ))}
        </div>

        {isEditing ? (
          <div className="space-y-3">
            <div>
              <label className="block text-sm text-charcoal-light mb-1">Reader's Note</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-4 py-3 border border-charcoal-lighter rounded bg-cream focus:outline-none focus:border-charcoal transition-colors min-h-32 resize-y"
                placeholder="Write your thoughts about this book..."
              />
            </div>
            <button
              onClick={handleSave}
              className="px-6 py-2 bg-charcoal text-cream rounded hover:bg-charcoal-light transition-colors"
            >
              Save Journal Entry
            </button>
          </div>
        ) : book.notes ? (
          <div className="bg-cream rounded p-4 border border-cream-dark">
            <p className="text-sm text-charcoal-light italic whitespace-pre-wrap">{book.notes}</p>
          </div>
        ) : null}
      </div>
    </div>
  )
}

export default App
