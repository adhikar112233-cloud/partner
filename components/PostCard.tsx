
import React, { useState, useEffect, useRef } from 'react';
import { Post, User, Comment } from '../types';
import { apiService } from '../services/apiService';
import { Timestamp } from 'firebase/firestore';
import { GlobeIcon, LockClosedIcon, ImageIcon, TrashIcon } from './Icons';

const formatTimeAgo = (timestamp: any) => {
    if (!timestamp?.toDate) return 'Just now';
    const date = timestamp.toDate();
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    let interval = seconds / 31536000;
    if (interval > 1) return Math.floor(interval) + "y";
    interval = seconds / 2592000;
    if (interval > 1) return Math.floor(interval) + "mo";
    interval = seconds / 86400;
    if (interval > 1) return Math.floor(interval) + "d";
    interval = seconds / 3600;
    if (interval > 1) return Math.floor(interval) + "h";
    interval = seconds / 60;
    if (interval > 1) return Math.floor(interval) + "m";
    return Math.floor(seconds) + "s";
};

const CommentSection: React.FC<{ post: Post, currentUser: User, onCommentChange: (postId: string, change: 'increment' | 'decrement') => void }> = ({ post, currentUser, onCommentChange }) => {
    const [comments, setComments] = useState<Comment[]>([]);
    const [newComment, setNewComment] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isPosting, setIsPosting] = useState(false);

    useEffect(() => {
        apiService.getCommentsForPost(post.id).then(setComments).finally(() => setIsLoading(false));
    }, [post.id]);
    
    const handleAddComment = async (e: React.FormEvent) => {
        e.preventDefault();
        if(!newComment.trim()) return;
        setIsPosting(true);
        try {
            await apiService.addCommentToPost(post.id, {
                postId: post.id,
                userId: currentUser.id,
                userName: currentUser.name,
                userAvatar: currentUser.avatar || '',
                text: newComment,
            });
            setNewComment('');
            onCommentChange(post.id, 'increment');
            // Refresh comments
            const updatedComments = await apiService.getCommentsForPost(post.id);
            setComments(updatedComments);
        } finally {
            setIsPosting(false);
        }
    };

    return (
        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            {isLoading ? <p className="text-sm text-gray-500 dark:text-gray-400">Loading comments...</p> : comments.map(comment => (
                <div key={comment.id} className="flex items-start space-x-3 mb-3">
                    <img src={comment.userAvatar} alt={comment.userName} className="w-8 h-8 rounded-full" />
                    <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-2">
                        <p className="font-semibold text-sm dark:text-gray-200">{comment.userName}</p>
                        <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{comment.text}</p>
                    </div>
                </div>
            ))}
            <form onSubmit={handleAddComment} className="flex items-center space-x-3 mt-4">
                 <img src={currentUser.avatar} alt={currentUser.name} className="w-8 h-8 rounded-full flex-shrink-0" />
                 <div className="relative flex-1">
                    <input 
                        type="text" 
                        value={newComment}
                        onChange={e => setNewComment(e.target.value)}
                        placeholder="Write a comment..."
                        disabled={isPosting}
                        className="w-full border-gray-300 rounded-full px-4 py-2 pr-12 text-sm focus:ring-indigo-500 disabled:bg-gray-100 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200"
                    />
                    <button 
                        type="submit"
                        disabled={!newComment.trim() || isPosting}
                        className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 text-indigo-600 rounded-full hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-gray-600 disabled:opacity-50 transition-colors"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                            <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
                        </svg>
                    </button>
                 </div>
            </form>
        </div>
    );
};

interface PostCardProps {
    post: Post;
    currentUser: User;
    onDelete: (postId: string) => void;
    onUpdate: (postId: string, data: Partial<Post>) => Promise<void> | void;
    onToggleLike: (postId: string, currentLikes: string[]) => void;
    onCommentChange: (postId: string, change: 'increment' | 'decrement') => void;
}

const PostCard: React.FC<PostCardProps> = ({ post, currentUser, onDelete, onUpdate, onToggleLike, onCommentChange }) => {
    const [showComments, setShowComments] = useState(false);
    const [showOptions, setShowOptions] = useState(false);
    
    // Editing State
    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [editText, setEditText] = useState(post.text);
    const [editVisibility, setEditVisibility] = useState<'public' | 'private'>(post.visibility || 'public');
    const [editImageFile, setEditImageFile] = useState<File | null>(null);
    const [editImageUrl, setEditImageUrl] = useState<string | null>(post.imageUrl || null);
    const [error, setError] = useState<string | null>(null);
    
    const optionsRef = useRef<HTMLDivElement>(null);
    const editFileInputRef = useRef<HTMLInputElement>(null);
    
    const isOwner = post.userId === currentUser.id;
    const isAdmin = currentUser.role === 'staff';
    const isLiked = post.likes.includes(currentUser.id);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (optionsRef.current && !optionsRef.current.contains(event.target as Node)) {
                setShowOptions(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleBlock = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        onUpdate(post.id, { isBlocked: !post.isBlocked });
        setShowOptions(false);
    }

    const handleDelete = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setShowOptions(false);
        onDelete(post.id);
    }

    const handleEditClick = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsEditing(true);
        // Reset fields to current post values
        setEditText(post.text);
        setEditVisibility(post.visibility || 'public');
        setEditImageUrl(post.imageUrl || null);
        setEditImageFile(null);
        setError(null);
        setShowOptions(false);
    }

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setEditImageFile(e.target.files[0]);
            setError(null);
        }
    };

    const handleRemoveImage = () => {
        setEditImageFile(null);
        setEditImageUrl(null);
        if (editFileInputRef.current) editFileInputRef.current.value = '';
    };

    const handleSaveEdit = async (e: React.MouseEvent) => {
        e.preventDefault();
        
        if (!editText.trim() && !editImageFile && !editImageUrl) {
            setError("Post cannot be empty. Please add text or an image.");
            return;
        }

        setIsSaving(true);
        setError(null);
        
        try {
            let finalImageUrl = editImageUrl;

            // Upload new image if selected
            if (editImageFile) {
                finalImageUrl = await apiService.uploadPostImage(post.id, editImageFile);
            }

            const updateData: Partial<Post> = {
                text: editText,
                visibility: editVisibility,
                imageUrl: finalImageUrl || null // explicitly set to null if removed
            };

            await onUpdate(post.id, updateData);
            setIsEditing(false);
        } catch (error) {
            console.error("Failed to save post changes:", error);
            setError("Failed to save changes. Please try again.");
        } finally {
            setIsSaving(false);
        }
    }

    const handleCancelEdit = (e: React.MouseEvent) => {
        e.preventDefault();
        setIsEditing(false);
        // Reset locally
        setEditText(post.text);
        setEditVisibility(post.visibility || 'public');
        setEditImageUrl(post.imageUrl || null);
        setEditImageFile(null);
        setError(null);
    }

    // Determine what to show in edit preview
    const previewUrl = editImageFile ? URL.createObjectURL(editImageFile) : editImageUrl;

    return (
        <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 ${post.isBlocked ? 'opacity-60 bg-gray-100' : ''}`}>
            <div className="flex items-center justify-between relative">
                <div className="flex items-center space-x-3">
                    <img src={post.userAvatar} alt={post.userName} className="w-10 h-10 rounded-full object-cover" />
                    <div>
                        <p className="font-bold dark:text-gray-100">{post.userName}</p>
                        <div className="flex items-center space-x-2">
                             <p className="text-xs text-gray-500 dark:text-gray-400">{formatTimeAgo(post.timestamp)}</p>
                             {post.visibility === 'private' ? <LockClosedIcon className="w-3 h-3 text-gray-400" /> : <GlobeIcon className="w-3 h-3 text-gray-400" />}
                             {post.isBlocked && <span className="text-xs font-bold text-red-500 bg-red-100 px-2 py-0.5 rounded-full">Blocked</span>}
                        </div>
                    </div>
                </div>
                {(isOwner || isAdmin) && !isEditing && (
                    <div className="relative z-10" ref={optionsRef} onClick={(e) => e.stopPropagation()}>
                        <button onClick={() => setShowOptions(!showOptions)} className="text-gray-500 font-bold p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700">...</button>
                        {showOptions && (
                            <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg z-[110] border dark:bg-gray-800 dark:border-gray-700 overflow-hidden" onClick={(e) => e.stopPropagation()}>
                                {isOwner && (
                                    <button onClick={handleEditClick} className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 dark:text-gray-200">Edit Post</button>
                                )}
                                {isAdmin && (
                                    <>
                                        <button onClick={handleBlock} className="block w-full text-left px-4 py-2 text-sm text-yellow-700 hover:bg-gray-100 dark:hover:bg-gray-700 dark:text-yellow-500">
                                            {post.isBlocked ? 'Unblock' : 'Block'} Post
                                        </button>
                                        <button onClick={handleDelete} className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100 dark:hover:bg-gray-700 dark:text-red-400">Delete Post</button>
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>
            
            {isEditing ? (
                <div className="mt-4 space-y-3 animate-fade-in-down">
                    <textarea
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        rows={3}
                        disabled={isSaving}
                        className="w-full p-2 text-sm border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200 resize-none focus:ring-indigo-500 focus:border-indigo-500 disabled:opacity-60"
                        placeholder="What's on your mind?"
                    />
                    
                    {/* Image Edit Area */}
                    <div className="border rounded-md p-2 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50">
                        {previewUrl ? (
                            <div className="relative group">
                                <img src={previewUrl} alt="Preview" className="w-full rounded-lg object-cover max-h-[300px]" />
                                {!isSaving && (
                                    <div className="absolute top-2 right-2 flex space-x-2">
                                        <button 
                                            onClick={() => editFileInputRef.current?.click()} 
                                            className="bg-white text-gray-700 p-1.5 rounded-full shadow hover:bg-gray-100" 
                                            title="Change Image"
                                        >
                                            <ImageIcon className="w-4 h-4" />
                                        </button>
                                        <button 
                                            onClick={handleRemoveImage} 
                                            className="bg-red-600 text-white p-1.5 rounded-full shadow hover:bg-red-700" 
                                            title="Remove Image"
                                        >
                                            <TrashIcon className="w-4 h-4" />
                                        </button>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <button 
                                onClick={() => editFileInputRef.current?.click()} 
                                disabled={isSaving}
                                className="w-full flex items-center justify-center py-6 text-gray-500 hover:text-indigo-600 dark:text-gray-400 dark:hover:text-indigo-400 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-indigo-400 transition-colors"
                            >
                                <ImageIcon className="w-6 h-6 mr-2" />
                                Add Image
                            </button>
                        )}
                        <input type="file" ref={editFileInputRef} className="hidden" accept="image/*" onChange={handleImageChange} />
                    </div>

                    <div className="flex items-center justify-between pt-2">
                        <div className="flex items-center space-x-2">
                            <select
                                value={editVisibility}
                                onChange={(e) => setEditVisibility(e.target.value as 'public' | 'private')}
                                disabled={isSaving}
                                className="text-sm bg-white border border-gray-300 rounded-md px-3 py-1.5 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300 focus:ring-indigo-500 focus:border-indigo-500"
                            >
                                <option value="public">Public</option>
                                <option value="private">Private</option>
                            </select>
                            <span className="text-gray-500 dark:text-gray-400">
                                {editVisibility === 'public' ? <GlobeIcon className="w-5 h-5" /> : <LockClosedIcon className="w-5 h-5" />}
                            </span>
                        </div>
                        <div className="flex space-x-2">
                            <button 
                                onClick={handleCancelEdit} 
                                disabled={isSaving}
                                className="px-3 py-1.5 text-sm text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={handleSaveEdit} 
                                disabled={isSaving}
                                className="px-4 py-1.5 text-sm text-white bg-indigo-600 rounded-md hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center"
                            >
                                {isSaving ? 'Saving...' : 'Save'}
                            </button>
                        </div>
                    </div>
                    {error && <p className="text-sm text-red-500 mt-2 text-center">{error}</p>}
                </div>
            ) : (
                <>
                    <p className="my-4 text-gray-800 whitespace-pre-wrap dark:text-gray-200">{post.text}</p>
                    {post.imageUrl && <img src={post.imageUrl} alt="Post content" className="w-full rounded-lg object-cover max-h-[500px]" />}
                </>
            )}
            
            <div className="flex justify-between items-center mt-4 text-sm text-gray-500 dark:text-gray-400">
                <span>{post.likes.length} Likes</span>
                <span>{post.commentCount} Comments</span>
            </div>

            <div className="flex border-t border-b my-2 dark:border-gray-700">
                <button onClick={() => onToggleLike(post.id, post.likes)} className={`w-1/2 py-2 flex justify-center items-center gap-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-l-md ${isLiked ? 'text-indigo-600 font-semibold' : 'text-gray-600 dark:text-gray-400'}`}>
                    <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 transition-transform ${isLiked ? 'scale-110' : ''}`} viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" /></svg>
                    Like
                </button>
                <button onClick={() => setShowComments(!showComments)} className="w-1/2 py-2 flex justify-center items-center gap-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-r-md text-gray-600 dark:text-gray-400">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                    Comment
                </button>
            </div>
            {showComments && <CommentSection post={post} currentUser={currentUser} onCommentChange={onCommentChange} />}
        </div>
    );
};

export default PostCard;
