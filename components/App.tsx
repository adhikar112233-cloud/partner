  const [liveHelpSessionId, setLiveHelpSessionId] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isFeedOpen, setIsFeedOpen] = useState(false);

  const [appMode, setAppMode] = useState<'dashboard' | 'community'>('dashboard');
  const [communityFeedFilter, setCommunityFeedFilter] = useState<'global' | 'my_posts' | 'following'>('global');

  useEffect(() => {
    const root = window.document.documentElement;