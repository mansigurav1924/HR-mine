from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.svm import LinearSVC
from sklearn.calibration import CalibratedClassifierCV
from sklearn.pipeline import Pipeline
from .preprocessing import ResumeTextPreprocessor

def build_candidate_pipelines(random_state=42):
    """
    Returns a dictionary of candidate SKLearn Pipelines combining our 
    preprocessing, TF-IDF vectorization, and the estimator.
    """
    tfidf = TfidfVectorizer(
        ngram_range=(1, 2),
        sublinear_tf=True,
        min_df=2,
        max_df=0.95,
        max_features=10000
    )
    
    # Logistic Regression is highly interpretable and naturally outputs probabilities.
    lr = LogisticRegression(class_weight='balanced', random_state=random_state, max_iter=1000)
    
    # Linear SVC performs very well on high-dimensional sparse text.
    # We must wrap it in CalibratedClassifierCV because raw SVM decision functions are NOT probabilities.
    svm = LinearSVC(class_weight='balanced', random_state=random_state, dual=False)
    # Using 3 inner CV folds for calibration so it works even on very small datasets
    calibrated_svm = CalibratedClassifierCV(svm, cv=3) 
    
    pipelines = {
        'LogisticRegression': Pipeline([
            ('preprocessor', ResumeTextPreprocessor()),
            ('tfidf', tfidf),
            ('classifier', lr)
        ]),
        'LinearSVC': Pipeline([
            ('preprocessor', ResumeTextPreprocessor()),
            ('tfidf', tfidf),
            ('classifier', calibrated_svm)
        ])
    }
    
    return pipelines
