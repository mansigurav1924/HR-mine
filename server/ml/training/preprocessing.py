import re
from sklearn.base import BaseEstimator, TransformerMixin

class ResumeTextPreprocessor(BaseEstimator, TransformerMixin):

    def __init__(self):
        # Basic patterns for direct identifiers
        self.email_pattern = re.compile(r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}')
        # Matches numbers like +1 555-123-4567 or 555 123 4567
        self.phone_pattern = re.compile(r'(?:\+?\d{1,3}[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}')
        self.url_pattern = re.compile(r'https?://\S+|www\.\S+')
        self.whitespace_pattern = re.compile(r'\s+')
        
    def fit(self, X, y=None):
        return self
        
    def transform(self, X, y=None):
        cleaned_X = []
        for text in X:
            if not isinstance(text, str):
                text = str(text)
                
            # Masking
            text = self.email_pattern.sub(' [EMAIL] ', text)
            text = self.url_pattern.sub(' [URL] ', text)
            text = self.phone_pattern.sub(' [PHONE] ', text)
            
            # Normalize whitespace
            text = self.whitespace_pattern.sub(' ', text).strip()
            
            # Lowercase helps with TF-IDF consistency
            cleaned_X.append(text.lower())
            
        return cleaned_X
