

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { User, Post } from '../types';
import { apiService } from '../services/apiService';
import { serverTimestamp } from 'firebase/firestore';
import PostCard from './PostCard';
import { ImageIcon, GlobeIcon, LockClosedIcon } from './Icons';

interface CommunityPageProps {
    user: User;
}

const CreatePostForm: React.FC<{ user: User; onPostCreated: () => void; }> = ({ user, onPostCreated }) => {
    const [text, setText] = useState('');
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [visibility, setVisibility] = useState<'public' | 'private'>('public');
    const [isPosting, setIsPosting] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.[0]) {
            const file = e.target.files[0];
            setImageFile(file);
            setImagePreview(URL.createObjectURL(file));
        }
    };

    const handlePost = async () => {
        if (!text.trim() && !imageFile) return;

        setIsPosting(true);
        try {
            const newPost: Omit<Post, 'id'> = {
                 userId: user.id,
                 userName: user.name,
                 userAvatar: user.avatar || '',
                 userRole: user.role,
                 text,
                 likes: [],
                 commentCount: 0,
                 timestamp: serverTimestamp(),
                 isBlocked: false,
                 visibility,
            };
            const createdPost = await apiService.createPost(newPost);

            if (imageFile) {
                const imageUrl = await apiService.uploadPostImage(createdPost.id, imageFile);
                await apiService.updatePost(createdPost.id, { imageUrl });
            }

            setText('');
            setImageFile(null);
            setImagePreview(null);
            setVisibility('public');
            if (fileInputRef.current) fileInputRef.current.value = '';
            onPostCreated();
        } catch (error) {
            console.error("Error creating post:", error);
        } finally {
            setIsPosting(false);
        }
    };

    return (
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md mb-6">
            <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                className="w-full border-0 p-2 text-gray-700 bg-gray-100 rounded-md placeholder-gray-400 focus:ring-0 resize-none dark:bg-gray-700 dark:text-gray-200"
                placeholder={`What's on your mind, ${user.name}?`}
                rows={3}
            />
            {imagePreview && (
                <div className="mt-2 relative">
                    <img src={imagePreview} alt="Preview" className="w-full h-auto max-h-60 object-cover rounded-lg" />
                    <button onClick={() => {setImageFile(null); setImagePreview(null); if (fileInputRef.current) fileInputRef.current.value = '';}} className="absolute top-2 right-2 bg-black bg-opacity-50 text-white rounded-full p-1 leading-none w-6 h-6 flex items-center justify-center">&times;</button>
                </div>
            )}
            <div className="flex justify-between items-center mt-2 pt-2 border-t dark:border-gray-700">
                <div className="flex items-center gap-4">
                    <label htmlFor="post-image-upload" className="cursor-pointer text-gray-500 hover:text-indigo-600 dark:text-gray-400 dark:hover:text-indigo-400">
                        <ImageIcon className="w-6 h-6" />
                        <input id="post-image-upload" ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
                    </label>
                    <select 
                        value={visibility} 
                        onChange={(e) => setVisibility(e.target.value as 'public' | 'private')}
                        className="text-sm bg-gray-100 border-0 rounded-md text-gray-700 focus:ring-indigo-500 dark:bg-gray-700 dark:text-gray-300"
                    >
                        <option value="public">Public</option>
                        <option value="private">Private</option>
                    </select>
                    <div className="text-gray-500 dark:text-gray-400">
                        {visibility === 'public' ? <GlobeIcon className="w-5 h-5" /> : <LockClosedIcon className="w-5 h-5" />}
                    </div>
                </div>
                <button
                    onClick={handlePost}
                    disabled={isPosting || (!text.trim() && !imageFile)}
                    className="px-6 py-2 font-semibold text-white bg-indigo-600 rounded-lg shadow-sm hover:bg-indigo-700 disabled:opacity-50"
                >
                    {isPosting ? 'Posting...' : 'Post'}
                </button>
            </div>
        </div>
    );
};

const CommunityPage: React.FC<CommunityPageProps> = ({ user }) => {
    const [posts, setPosts] = useState<Post[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const fetchPosts = useCallback(async () => {
        setIsLoading(true);
        try {
            // Fetch posts passing user.id so private posts can be retrieved
            const postsData = await apiService.getPosts(user.id);
            setPosts(postsData);
        } catch (error) {
            console.error("Failed to fetch posts:", error);
        } finally {
            setIsLoading(false);
        }
    }, [user.id]);

    useEffect(() => {
        fetchPosts();
    }, [fetchPosts]);
    
    const handleDeletePost = async (postId: string) => {
        if(window.confirm("Are you sure you want to delete this post?")) {
            await apiService.deletePost(postId);
            setPosts(posts.filter(p => p.id !== postId));
        }
    };
    
    const handleUpdatePost = async (postId: string, data: Partial<Post>) => {
        await apiService.updatePost(postId, data);
        // If an admin blocks a post, it should disappear from the public feed
        if (data.isBlocked) {
            setPosts(posts.filter(p => p.id !== postId));
        } else {
            setPosts(posts.map(p => p.id === postId ? {...p, ...data} : p));
        }
    };

    const handleToggleLike = async (postId: string, currentLikes: string[]) => {
        const isLiked = currentLikes.includes(user.id);
        const newLikes = isLiked ? currentLikes.filter(id => id !== user.id) : [...currentLikes, user.id];
        setPosts(posts.map(p => p.id === postId ? { ...p, likes: newLikes } : p));
        
        await apiService.toggleLikePost(postId, user.id);
    };

    const handleCommentChange = (postId: string, change: 'increment' | 'decrement') => {
        setPosts(posts.map(p => p.id === postId ? { ...p, commentCount: p.commentCount + (change === 'increment' ? 1 : -1) } : p));
    };


    return (
        <div className="max-w-4xl mx-auto">
            <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100 mb-6">Community Feed</h1>
            <CreatePostForm user={user} onPostCreated={fetchPosts} />
            
            {isLoading ? (
                <p className="text-gray-600 dark:text-gray-300">Loading feed...</p>
            ) : posts.length === 0 ? (
                <div className="text-center py-10 bg-white dark:bg-gray-800 rounded-lg shadow"><p className="text-gray-500 dark:text-gray-400">The feed is empty. Be the first to post!</p></div>
            ) : (
                <div className="space-y-6">
                    {posts.map(post => (
                        <PostCard 
                            key={post.id} 
                            post={post} 
                            currentUser={user}
                            onDelete={handleDeletePost}
                            onUpdate={handleUpdatePost}
                            onToggleLike={handleToggleLike}
                            onCommentChange={handleCommentChange}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

export default CommunityPage;