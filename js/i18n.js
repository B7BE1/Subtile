"use strict";

const I18n = (() => {
  let currentLang = localStorage.getItem('subtile_lang') || 'en';

  const strings = {
    en: {
      trending: 'Trending',
      browse: 'Browse',
      searchPlaceholder: 'Search movies, series, anime...',
      login: 'Login',
      signup: 'Sign Up',
      profile: 'Profile',
      logout: 'Logout',
      watchlist: 'Watchlist',
      addToWatchlist: 'Add to Watchlist',
      removeFromWatchlist: 'Remove from Watchlist',
      rateAndReview: 'Rate & Review',
      submitReview: 'Submit Review',
      reviews: 'Reviews',
      noReviews: 'No reviews yet. Be the first!',
      loginToReview: 'Login to leave a review',
      subtitlesArchive: 'Subtitles Archive',
      availableSubtitles: 'Available Subtitles',
      allLanguages: 'All Languages',
      download: 'Download',
      upload: 'Upload',
      uploadSubtitle: 'Upload Subtitle',
      movie: 'Movie',
      tvSeries: 'TV Series',
      anime: 'Anime',
      seasons: 'Seasons',
      backToSeasons: 'Back to Seasons',
      noSubtitlesFound: 'No subtitles found',
      tryAnotherFilter: 'Try another filter or upload one.',
      followUs: 'Follow Us',
      home: 'Home',
      signIn: 'Sign In',
      createAccount: 'Create Account',
      username: 'Username',
      email: 'Email',
      password: 'Password',
      forgotPassword: 'Forgot Password?',
      darkMode: 'Dark Mode',
      lightMode: 'Light Mode',
      memberSince: 'Member since',
      editProfile: 'Edit Profile',
      save: 'Save',
      cancel: 'Cancel',
      bio: 'Bio',
      uploads: 'Uploads',
      downloads: 'Downloads',
      myUploads: 'My Uploads',
      myReviews: 'My Reviews',
      nothingHereYet: 'Nothing here yet',
      startExploring: 'Start exploring and adding content!',
      browseMovies: 'Browse Movies',
      browseSeries: 'Browse Series',
      browseAnime: 'Browse Anime',
      officialSubtitleRepos: 'Official Subtitle Repos',
      noTitleFound: 'No exact title match found...',
      enterUrlOrPasteCode: 'Enter URL or paste Code/Subtitle...',
      linkAdded: 'Link added to the list!',
      enterValidUrl: 'Please enter a valid URL or code.',
      copiedToClipboard: 'Copied to clipboard!',
      provideCodeOrUrl: 'Please provide a code or a URL.',
      language: 'Language',
      releasingSoon: 'Releasing Soon',
      privacyPolicy: 'Privacy Policy',
      contactUs: 'Contact Us',
      clearFilters: 'Clear all filters',
      availableSubtitleFiles: 'Available Subtitle Files',
      communityMaintained: 'Community maintained',
      season: 'Season',
      episode: 'Episode'
    },
    ar: {
      trending: 'الرائج',
      browse: 'تصفح',
      searchPlaceholder: 'ابحث عن أفلام، مسلسلات، أنمي...',
      login: 'تسجيل الدخول',
      signup: 'إنشاء حساب',
      profile: 'الملف الشخصي',
      logout: 'تسجيل الخروج',
      watchlist: 'قائمة المتابعة',
      addToWatchlist: 'إضافة للمتابعة',
      removeFromWatchlist: 'إزالة من المتابعة',
      rateAndReview: 'قيّم وعلّق',
      submitReview: 'إرسال التقييم',
      reviews: 'التقييمات',
      noReviews: 'لا توجد تقييمات بعد. كن أول من يقيّم!',
      loginToReview: 'سجّل دخولك لتكتب تقييم',
      subtitlesArchive: 'أرشيف الترجمات',
      availableSubtitles: 'الترجمات المتاحة',
      allLanguages: 'جميع اللغات',
      download: 'تحميل',
      upload: 'رفع',
      uploadSubtitle: 'رفع ترجمة',
      movie: 'فيلم',
      tvSeries: 'مسلسل',
      anime: 'أنمي',
      seasons: 'المواسم',
      backToSeasons: 'العودة للمواسم',
      noSubtitlesFound: 'لم يتم العثور على ترجمات',
      tryAnotherFilter: 'جرّب فلتر آخر أو ارفع ترجمة.',
      followUs: 'تابعنا',
      home: 'الرئيسية',
      signIn: 'تسجيل الدخول',
      createAccount: 'إنشاء حساب',
      username: 'اسم المستخدم',
      email: 'البريد الإلكتروني',
      password: 'كلمة المرور',
      forgotPassword: 'نسيت كلمة المرور؟',
      darkMode: 'الوضع الداكن',
      lightMode: 'الوضع الفاتح',
      memberSince: 'عضو منذ',
      editProfile: 'تعديل الملف الشخصي',
      save: 'حفظ',
      cancel: 'إلغاء',
      bio: 'النبذة التعريفية',
      uploads: 'الرفعات',
      downloads: 'التحميلات',
      myUploads: 'رفعاتي',
      myReviews: 'تقييماتي',
      nothingHereYet: 'لا يوجد شيء هنا بعد',
      startExploring: 'ابدأ بالتصفح!',
      browseMovies: 'تصفح الأفلام',
      browseSeries: 'تصفح المسلسلات',
      browseAnime: 'تصفح الأنمي',
      officialSubtitleRepos: 'مستودعات الترجمة الرسمية',
      noTitleFound: 'لم يتم العثور على عنوان مطابق...',
      enterUrlOrPasteCode: 'أدخل رابط أو الصق كود/ترجمة...',
      linkAdded: 'تمت إضافة الرابط للقائمة!',
      enterValidUrl: 'يرجى إدخال رابط أو كود صالح.',
      copiedToClipboard: 'تم النسخ!',
      provideCodeOrUrl: 'يرجى إدخال كود أو رابط.',
      language: 'اللغة',
      releasingSoon: 'قريباً',
      privacyPolicy: 'سياسة الخصوصية',
      contactUs: 'تواصل معنا',
      clearFilters: 'مسح جميع الفلاتر',
      availableSubtitleFiles: 'ملفات الترجمة المتاحة',
      communityMaintained: 'يُديرها المجتمع',
      season: 'الموسم',
      episode: 'الحلقة'
    }
  };

  function t(key) {
    return (strings[currentLang] && strings[currentLang][key]) || strings.en[key] || key;
  }

  function setLang(lang) {
    if (lang !== 'en' && lang !== 'ar') return;
    currentLang = lang;
    localStorage.setItem('subtile_lang', lang);
    applyDirection();
  }

  function getLang() {
    return currentLang;
  }

  function applyDirection() {
    const isRtl = currentLang === 'ar';
    document.documentElement.dir = isRtl ? 'rtl' : 'ltr';
    document.documentElement.lang = currentLang;
    document.body.style.textAlign = isRtl ? 'right' : 'left';
  }

  function translatePage() {
    applyDirection();
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      const translated = t(key);
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
        el.placeholder = translated;
      } else {
        el.textContent = translated;
      }
    });
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
      el.title = t(el.getAttribute('data-i18n-title'));
    });
  }

  return { t, setLang, getLang, applyDirection, translatePage };
})();
