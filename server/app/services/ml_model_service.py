import os
import sys
import json
import joblib
from fastapi import HTTPException

# Add the ml directory to sys path so joblib can deserialize the Custom Preprocessor correctly
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))

class MLModelService:
    _instance = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(MLModelService, cls).__new__(cls)
            cls._instance._initialized = False
        return cls._instance
        
    def __init__(self):
        if self._initialized:
            return
            
        self.model = None
        self.metadata = None
        self.available = False
        
        self.version = os.environ.get("ML_MODEL_VERSION")
        self.model_path = os.environ.get("ML_MODEL_PATH")
        self.metadata_path = os.environ.get("ML_MODEL_METADATA_PATH")
        
        self._load_model()
        self._initialized = True
        
    def _load_model(self):
        if not self.version or not self.model_path or not self.metadata_path:
            return
            
        base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
        full_model_path = os.path.join(base_dir, self.model_path)
        full_metadata_path = os.path.join(base_dir, self.metadata_path)
        
        try:
            if not os.path.exists(full_model_path) or not os.path.exists(full_metadata_path):
                return
                
            self.model = joblib.load(full_model_path)
            
            with open(full_metadata_path, 'r') as f:
                self.metadata = json.load(f)
                
            if self.metadata.get("model_version") != self.version:
                # Version mismatch
                self.model = None
                self.metadata = None
                return
                
            self.available = True
            
        except Exception as e:
            print(f"Error loading ML model: {e}")
            self.model = None
            self.metadata = None
            self.available = False
            
    def get_info(self):
        if not self.available:
            return {"available": False}
        return {
            "available": True,
            "model_version": self.version,
            "algorithm": self.metadata.get("algorithm"),
            "labels": self.metadata.get("labels", [])
        }
        
    def predict(self, text: str):
        if not self.available:
            raise HTTPException(status_code=503, detail="ML model is currently unavailable.")
            
        # Run pipeline inference
        try:
            predicted_class = self.model.predict([text])[0]
            
            # Predict Probabilities
            probability = None
            if hasattr(self.model, "predict_proba"):
                probs = self.model.predict_proba([text])[0]
                classes = list(self.model.classes_)
                
                # Fetch probability of 'good_intern'
                if "good_intern" in classes:
                    good_index = classes.index("good_intern")
                    probability = float(probs[good_index])
                    
            if predicted_class not in ["good_intern", "bad_intern"]:
                raise HTTPException(status_code=500, detail="Model predicted an unexpected class label.")
                
            return {
                "predicted_class": predicted_class,
                "match_score": probability
            }
        except Exception as e:
            print(f"Prediction Error: {e}")
            raise HTTPException(status_code=500, detail="Failed to run ML inference on this candidate.")
