
import React, { useEffect, useRef, useState } from 'react';
import { Article, ArticleComment } from '../types';
import { api } from '../services/api';
import { Tag } from './Tag';
import { 
  X, Share2, MoreHorizontal, ExternalLink, Quote, Heart, 
  Link as LinkIcon, Twitter, Linkedin, Check, MessageCircle, Send, Trash2
} from 'lucide-react';

interface ArticleModalProps {
  article: Article | null;
  onClose: () => void;
  onAuthorClick?: (authorName: string) => void;
  onSave?: (article: Article) => void;
  relatedArticles?: Article[];
  onOpenArticle?: (article: Article) => void;
  canInteract?: boolean;
  onRequireAuth?: () => void;
}

export const ArticleModal: React.FC<ArticleModalProps> = ({ 
  article, 
  onClose, 
  onAuthorClick, 
  onSave,
  relatedArticles,
  onOpenArticle,
  canInteract = true,
  onRequireAuth
}) => {
  const contentRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  
  // Share Menu State
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [comments, setComments] = useState<ArticleComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentsError, setCommentsError] = useState<string | null>(null);
  const [commentDraft, setCommentDraft] = useState('');
  const [commentSubmitting, setCommentSubmitting] = useState(false);

  // Lock body scroll when modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    closeButtonRef.current?.focus();

    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeydown);

    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleKeydown);
    };
  }, [onClose]);

  // Reset state when article changes
  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTop = 0;
    }
    
    // Reset Like state
    setIsLiked(false);
    setLikeCount(article?.likes || 0);

    // Reset Share state
    setShowShareMenu(false);
    setLinkCopied(false);
    setComments([]);
    setCommentDraft('');
    setCommentsError(null);
  }, [article?.id, article?.likes]);

  useEffect(() => {
    if (!article?.id) return;

    let cancelled = false;
    const loadComments = async () => {
      setCommentsLoading(true);
      setCommentsError(null);
      try {
        const items = await api.getArticleComments(article.id);
        if (!cancelled) setComments(items);
      } catch (error) {
        if (!cancelled) setCommentsError('Comments are unavailable right now.');
      } finally {
        if (!cancelled) setCommentsLoading(false);
      }
    };

    loadComments();
    return () => {
      cancelled = true;
    };
  }, [article?.id]);

  if (!article) return null;

  const handleCite = () => {
    const authors = article.authors.map(a => a.name).join(', ');
    const year = new Date(article.publishedAt).getFullYear();
    const reference = article.doi || article.url || 'N/A';
    const citation = `${authors}. "${article.title}". ${article.source}, ${year}. DOI/URL: ${reference}`;
    navigator.clipboard.writeText(citation).then(() => {
       alert("Citation copied to clipboard!");
    }).catch(() => {
       alert("Failed to copy citation.");
    });
  };

  const handleLike = () => {
    if (!canInteract) {
      if (onRequireAuth) onRequireAuth();
      return;
    }
    const next = !isLiked;
    setIsLiked(next);
    setLikeCount(prev => next ? prev + 1 : Math.max(0, prev - 1));
    if (next) {
      api.toggleLike(article.id).catch(() => {
        setIsLiked(!next);
        setLikeCount(prev => Math.max(0, prev - 1));
      });
    }
  };

  // Share Logic
  const handleCopyLink = () => {
    const url = `${window.location.origin}?article=${article.id}`;
    navigator.clipboard.writeText(url).then(() => {
        setLinkCopied(true);
        setTimeout(() => {
            setLinkCopied(false);
            setShowShareMenu(false);
        }, 1500);
    });
  };

  const handleSocialShare = (platform: string) => {
    const shareUrl = `${window.location.origin}?article=${article.id}`;
    const text = encodeURIComponent(`Check out this article: ${article.title}`);
    const url = encodeURIComponent(shareUrl);
    
    let link = '';
    switch(platform) {
        case 'twitter': link = `https://twitter.com/intent/tweet?text=${text}&url=${url}`; break;
        case 'linkedin': link = `https://www.linkedin.com/sharing/share-offsite/?url=${url}`; break;
        case 'email': link = `mailto:?subject=${encodeURIComponent(article.title)}&body=${text}%0A%0A${url}`; break;
    }
    
    if (link) {
        window.open(link, '_blank', 'width=600,height=400');
        setShowShareMenu(false);
    }
  };

  const handleSubmitComment = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canInteract) {
      if (onRequireAuth) onRequireAuth();
      return;
    }
    const content = commentDraft.trim();
    if (!content || commentSubmitting) return;

    setCommentSubmitting(true);
    setCommentsError(null);
    try {
      const created = await api.addArticleComment(article.id, content);
      setComments(prev => [...prev, created]);
      setCommentDraft('');
    } catch (error) {
      setCommentsError('Could not publish this comment.');
    } finally {
      setCommentSubmitting(false);
    }
  };

  const handleToggleCommentReaction = async (comment: ArticleComment) => {
    if (!canInteract) {
      if (onRequireAuth) onRequireAuth();
      return;
    }
    try {
      const updated = comment.viewerReaction
        ? await api.removeCommentReaction(comment.id, comment.viewerReaction)
        : await api.reactToComment(comment.id, 'heart');
      setComments(prev => prev.map(item => item.id === updated.id ? updated : item));
    } catch (error) {
      setCommentsError('Could not update the reaction.');
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    try {
      await api.deleteArticleComment(commentId);
      setComments(prev => prev.filter(comment => comment.id !== commentId));
    } catch (error) {
      setCommentsError('Could not delete this comment.');
    }
  };

  const formatCommentDate = (value: string) => {
    try {
      return new Intl.DateTimeFormat('en', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      }).format(new Date(value));
    } catch (error) {
      return '';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-2 sm:p-6 backdrop-blur-sm" onClick={onClose}>
      <div 
        role="dialog"
        aria-modal="true"
        aria-labelledby="article-modal-title"
        className="bg-white dark:bg-dark-card rounded-2xl sm:rounded-3xl w-full max-w-5xl h-[calc(100dvh-1rem)] sm:h-[85vh] md:h-[90vh] shadow-2xl flex flex-col md:flex-row overflow-hidden relative transition-colors"
        onClick={e => e.stopPropagation()}
      >
        {/* Close Button Mobile */}
        <button 
          ref={closeButtonRef}
          onClick={onClose}
          aria-label="Close article"
          className="absolute top-3 left-3 z-30 p-2 bg-white/70 backdrop-blur-md rounded-full md:hidden hover:bg-white transition-colors"
        >
          <X size={20} className="text-gray-900" />
        </button>

        {/* Left: Image */}
        <div className="w-full md:w-1/2 h-44 sm:h-56 md:h-full bg-gray-100 dark:bg-black/50 relative shrink-0">
          <img 
            src={article.imageUrl} 
            alt={article.title} 
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent md:hidden" />
        </div>

        {/* Right: Content Panel */}
        <div className="flex-1 flex flex-col min-h-0 bg-white dark:bg-dark-card">
          
          {/* Header */}
          <div className="px-6 py-4 flex justify-between items-center border-b border-gray-100 dark:border-dark-border shrink-0 bg-white dark:bg-dark-card z-10">
            <div className="flex gap-2 relative">
               <button className="p-2 hover:bg-gray-100 dark:hover:bg-white/10 rounded-full transition-colors text-gray-700 dark:text-gray-300">
                 <MoreHorizontal size={20} />
               </button>
               
               <div className="relative">
                 <button 
                    onClick={() => setShowShareMenu(!showShareMenu)}
                    aria-label="Share article"
                    className={`p-2 rounded-full transition-colors text-gray-700 dark:text-gray-300 ${showShareMenu ? 'bg-black dark:bg-white text-white dark:text-black' : 'hover:bg-gray-100 dark:hover:bg-white/10'}`}
                 >
                   <Share2 size={20} />
                 </button>

                 {/* Share Dropdown */}
                 {showShareMenu && (
                   <>
                     <div className="fixed inset-0 z-40" onClick={() => setShowShareMenu(false)}></div>
                     <div className="fixed left-4 right-4 top-20 z-50 flex flex-col gap-1 rounded-2xl border border-gray-100 bg-white p-2 shadow-xl animate-in fade-in zoom-in-95 duration-200 dark:border-dark-border dark:bg-dark-card sm:absolute sm:left-0 sm:right-auto sm:top-full sm:mt-2 sm:w-56 sm:origin-top-left">
                        <div className="px-3 py-2 text-xs font-bold text-gray-400 uppercase tracking-wider">Share to</div>
                        <button onClick={handleCopyLink} className="flex items-center gap-3 px-3 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/10 rounded-xl transition-colors text-left w-full group">
                           {linkCopied ? <Check size={18} className="text-green-500" /> : <LinkIcon size={18} className="text-gray-500 dark:text-gray-400 group-hover:text-gray-900 dark:group-hover:text-white" />}
                           {linkCopied ? <span className="text-green-600">Copied!</span> : 'Copy Link'}
                        </button>
                        <button onClick={() => handleSocialShare('twitter')} className="flex items-center gap-3 px-3 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/10 rounded-xl transition-colors text-left w-full group">
                           <Twitter size={18} className="text-gray-500 dark:text-gray-400 group-hover:text-[#1DA1F2]" /> Twitter
                        </button>
                        <button onClick={() => handleSocialShare('linkedin')} className="flex items-center gap-3 px-3 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/10 rounded-xl transition-colors text-left w-full group">
                           <Linkedin size={18} className="text-gray-500 dark:text-gray-400 group-hover:text-[#0A66C2]" /> LinkedIn
                        </button>
                     </div>
                   </>
                 )}
               </div>
            </div>

            <div className="flex gap-3">
              <button 
                onClick={() => {
                  if (!canInteract) {
                    if (onRequireAuth) onRequireAuth();
                    return;
                  }
                  if (onSave) onSave(article);
                }}
                className="bg-primary text-white px-6 py-2 rounded-full font-bold hover:bg-red-700 transition-colors"
              >
                Save
              </button>
              <button 
                onClick={onClose}
                aria-label="Close article"
                className="hidden md:flex p-2 hover:bg-gray-100 dark:hover:bg-white/10 rounded-full transition-colors text-gray-700 dark:text-gray-300"
              >
                <X size={24} />
              </button>
            </div>
          </div>

          {/* Content */}
          <div 
            ref={contentRef}
            className="flex-1 overflow-y-auto custom-scrollbar px-6 md:px-8 py-6 overscroll-contain"
          >
            <div className="flex items-center gap-2 mb-3 text-sm text-gray-500 dark:text-gray-400">
               <span className="font-bold text-gray-900 dark:text-white">{article.source}</span>
               <span>•</span>
               <span className="truncate">{new Date(article.publishedAt).getFullYear()}</span>
            </div>

            <h1 id="article-modal-title" className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-6 leading-tight tracking-tight">
              {article.title}
            </h1>

            <p className="text-gray-800 dark:text-gray-200 leading-relaxed text-lg mb-6">
               {article.abstract}
            </p>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-3 sm:gap-4 mb-6">
               <button 
                 onClick={handleLike}
                 className={`flex items-center gap-2 px-4 py-2 rounded-full transition-colors ${isLiked ? 'bg-red-50 dark:bg-red-900/30 text-red-600' : 'bg-gray-100 dark:bg-white/10 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-white/20'}`}
               >
                 <Heart size={18} className={isLiked ? "fill-current" : ""} />
                 <span className="font-semibold text-sm">
                   {isLiked ? 'Liked' : 'Like'} 
                   <span className="ml-1 opacity-75">{likeCount > 0 ? likeCount : ''}</span>
                 </span>
               </button>

               <button 
                 onClick={handleCite}
                 className="flex items-center gap-2 px-4 py-2 rounded-full bg-gray-100 dark:bg-white/10 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-white/20 transition-colors"
               >
                 <Quote size={18} />
                 <span className="font-semibold text-sm">Cite</span>
               </button>
            </div>

            {/* Authors */}
            <div className="mb-8">
               <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-4">Authors</h3>
               <div className="flex flex-wrap gap-4">
                  {article.authors.map(author => (
                     <button 
                        key={author.id}
                        onClick={() => onAuthorClick && onAuthorClick(author.name)}
                        className="flex items-center gap-3 bg-gray-50 dark:bg-white/10 hover:bg-gray-100 dark:hover:bg-white/20 p-2 pr-4 rounded-full transition-colors"
                     >
                        <div className="w-8 h-8 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center text-gray-600 dark:text-gray-200 font-bold text-xs">
                            {author.name.charAt(0)}
                        </div>
                        <div className="text-left">
                            <p className="font-semibold text-sm text-gray-900 dark:text-white">{author.name}</p>
                        </div>
                     </button>
                  ))}
               </div>
            </div>

            {/* Tags */}
            <div className="mb-8">
              <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-3">Topics</h3>
              <div className="flex flex-wrap gap-2">
                {article.tags.map(tag => (
                  <Tag 
                    key={tag} 
                    label={tag} 
                    size="md"
                    selected={false}
                  />
                ))}
              </div>
            </div>

            {/* Comments */}
            <section className="mt-8 pt-8 border-t border-gray-100 dark:border-dark-border">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h3 className="flex items-center gap-2 text-base font-semibold text-gray-900 dark:text-white">
                  <MessageCircle size={18} />
                  Comments
                </h3>
                <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-500 dark:bg-white/10 dark:text-gray-300">
                  {comments.length}
                </span>
              </div>

              <form onSubmit={handleSubmitComment} className="mb-5">
                <div className="rounded-2xl border border-gray-200 bg-gray-50 p-3 dark:border-dark-border dark:bg-white/5">
                  <textarea
                    value={commentDraft}
                    onChange={(event) => setCommentDraft(event.target.value)}
                    onFocus={() => {
                      if (!canInteract && onRequireAuth) onRequireAuth();
                    }}
                    placeholder={canInteract ? 'Add a comment to this paper...' : 'Sign in to join the discussion'}
                    maxLength={2000}
                    rows={3}
                    disabled={!canInteract || commentSubmitting}
                    className="min-h-[84px] w-full resize-none bg-transparent text-sm leading-6 text-gray-900 outline-none placeholder:text-gray-400 disabled:cursor-not-allowed dark:text-white"
                  />
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <p className="text-xs text-gray-400">
                      {canInteract ? `${commentDraft.trim().length}/2000` : 'Guests can read comments.'}
                    </p>
                    <button
                      type="submit"
                      disabled={!canInteract || !commentDraft.trim() || commentSubmitting}
                      className="inline-flex items-center gap-2 rounded-full bg-gray-900 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-300 dark:bg-white dark:text-black dark:hover:bg-gray-200 dark:disabled:bg-white/20 dark:disabled:text-white/50"
                    >
                      <Send size={16} />
                      {commentSubmitting ? 'Posting' : 'Post'}
                    </button>
                  </div>
                </div>
              </form>

              {commentsError && (
                <div className="mb-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
                  {commentsError}
                </div>
              )}

              {commentsLoading ? (
                <div className="space-y-3">
                  {[0, 1].map(item => (
                    <div key={item} className="h-20 animate-pulse rounded-2xl bg-gray-100 dark:bg-white/10" />
                  ))}
                </div>
              ) : comments.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-gray-200 px-4 py-6 text-center text-sm text-gray-500 dark:border-dark-border dark:text-gray-400">
                  No comments yet.
                </div>
              ) : (
                <div className="space-y-4">
                  {comments.map(comment => {
                    const heartCount = comment.reactionCounts?.heart || 0;
                    return (
                      <article key={comment.id} className="rounded-2xl bg-gray-50 p-4 dark:bg-white/5">
                        <div className="mb-3 flex items-start justify-between gap-3">
                          <div className="flex min-w-0 items-center gap-3">
                            <img
                              src={comment.author.avatarUrl}
                              alt={comment.author.name}
                              className="h-9 w-9 rounded-full object-cover"
                            />
                            <div className="min-w-0">
                              <p className="truncate text-sm font-bold text-gray-900 dark:text-white">
                                {comment.author.name}
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                @{comment.author.nickname} · {formatCommentDate(comment.createdAt)}
                              </p>
                            </div>
                          </div>
                          {comment.canDelete && (
                            <button
                              type="button"
                              onClick={() => handleDeleteComment(comment.id)}
                              aria-label="Delete comment"
                              className="rounded-full p-2 text-gray-400 transition-colors hover:bg-white hover:text-red-600 dark:hover:bg-white/10"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                        <p className="whitespace-pre-wrap text-sm leading-6 text-gray-800 dark:text-gray-200">
                          {comment.content}
                        </p>
                        <div className="mt-3">
                          <button
                            type="button"
                            onClick={() => handleToggleCommentReaction(comment)}
                            className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold transition-colors ${comment.viewerReaction ? 'bg-red-50 text-red-600 dark:bg-red-900/30' : 'bg-white text-gray-600 hover:text-red-600 dark:bg-white/10 dark:text-gray-300'}`}
                          >
                            <Heart size={15} className={comment.viewerReaction ? 'fill-current' : ''} />
                            {heartCount > 0 ? heartCount : 'Like'}
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Related Articles */}
            {relatedArticles && relatedArticles.length > 0 && (
              <div className="mt-8 pt-8 border-t border-gray-100 dark:border-dark-border">
                <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-4">Related Articles</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-4">
                  {relatedArticles.map(related => (
                    <div 
                      key={related.id} 
                      className="cursor-pointer group flex flex-col"
                      onClick={() => onOpenArticle && onOpenArticle(related)}
                    >
                      <div className="aspect-[4/3] rounded-xl overflow-hidden bg-gray-100 dark:bg-white/5 mb-2 relative">
                        <img 
                          src={related.imageUrl} 
                          alt={related.title}
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                         <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors" />
                      </div>
                      <h4 className="font-semibold text-gray-900 dark:text-white text-sm leading-tight line-clamp-2 group-hover:text-primary transition-colors mb-1">
                        {related.title}
                      </h4>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{related.source}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-gray-100 dark:border-dark-border shrink-0 flex justify-between items-center bg-white dark:bg-dark-card z-10">
             <div className="text-xs text-gray-400 hidden sm:block">
                {article.doi ? `DOI: ${article.doi.replace('10.1038/', '')}` : 'DOI: N/A'}
             </div>
            {(() => {
              const link = article.url || (article.doi ? `https://doi.org/${article.doi}` : undefined);
              if (!link) return null;
              return (
                <a 
                  href={link}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 bg-gray-900 dark:bg-white text-white dark:text-black px-6 py-3 rounded-full font-bold text-sm hover:bg-gray-800 dark:hover:bg-gray-200 transition-all shadow-md ml-auto"
                >
                  Read full paper <ExternalLink size={16} />
                </a>
              );
            })()}
          </div>

        </div>
      </div>
    </div>
  );
};
