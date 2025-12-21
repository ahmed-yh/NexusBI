import os
import google.generativeai as genai
from flask import Flask, request, jsonify, render_template, session
from flask_session import Session
import pandas as pd
import numpy as np
from datetime import datetime
import logging
import json
from typing import Dict, Any, List, Tuple, Optional
from rich.console import Console
from rich.panel import Panel
from rich.table import Table
from sklearn.preprocessing import StandardScaler, LabelEncoder, OneHotEncoder
from sklearn.impute import SimpleImputer
from sklearn.compose import ColumnTransformer
import re
import sys
from dotenv import load_dotenv
import hashlib
import pathlib

# Load environment variables from .env file
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Initialize Rich console for beautiful output
console = Console()

# Cache configuration
CACHE_DIR = pathlib.Path(__file__).parent.parent / "cache"
CACHE_DIR.mkdir(exist_ok=True)
logger.info(f"Cache directory: {CACHE_DIR}")

class AnalysisCache:
    """Manage caching of analysis results to avoid redundant API calls"""
    
    @staticmethod
    def get_file_hash(file_path: str) -> str:
        """Generate a hash of the file to use as cache key"""
        hash_md5 = hashlib.md5()
        with open(file_path, "rb") as f:
            for chunk in iter(lambda: f.read(4096), b""):
                hash_md5.update(chunk)
        return hash_md5.hexdigest()
    
    @staticmethod
    def get_cache_dir(file_path: str) -> pathlib.Path:
        """Get the cache directory for a specific file"""
        file_hash = AnalysisCache.get_file_hash(file_path)
        file_name = pathlib.Path(file_path).stem
        cache_subdir = CACHE_DIR / f"{file_name}_{file_hash}"
        cache_subdir.mkdir(exist_ok=True)
        return cache_subdir
    
    @staticmethod
    def save_relationships(file_path: str, relationships: List[Dict[str, Any]]) -> None:
        """Save relationship analysis to cache"""
        cache_dir = AnalysisCache.get_cache_dir(file_path)
        cache_file = cache_dir / "relationships.json"
        
        cache_data = {
            'timestamp': datetime.now().isoformat(),
            'file_path': file_path,
            'relationships': relationships
        }
        
        with open(cache_file, 'w') as f:
            json.dump(cache_data, f, indent=2)
        
        logger.info(f"Saved relationships to cache: {cache_file}")
    
    @staticmethod
    def load_relationships(file_path: str) -> Optional[List[Dict[str, Any]]]:
        """Load relationship analysis from cache"""
        try:
            cache_dir = AnalysisCache.get_cache_dir(file_path)
            cache_file = cache_dir / "relationships.json"
            
            if cache_file.exists():
                with open(cache_file, 'r') as f:
                    cache_data = json.load(f)
                logger.info(f"Loaded relationships from cache: {cache_file}")
                return cache_data.get('relationships')
        except Exception as e:
            logger.warning(f"Failed to load relationships from cache: {e}")
        
        return None
    
    @staticmethod
    def save_report(file_path: str, report: str) -> None:
        """Save BI report to cache"""
        cache_dir = AnalysisCache.get_cache_dir(file_path)
        cache_file = cache_dir / "report.md"
        
        with open(cache_file, 'w') as f:
            f.write(f"<!-- Generated: {datetime.now().isoformat()} -->\n\n")
            f.write(report)
        
        logger.info(f"Saved BI report to cache: {cache_file}")
    
    @staticmethod
    def load_report(file_path: str) -> Optional[str]:
        """Load BI report from cache"""
        try:
            cache_dir = AnalysisCache.get_cache_dir(file_path)
            cache_file = cache_dir / "report.md"
            
            if cache_file.exists():
                with open(cache_file, 'r') as f:
                    report = f.read()
                logger.info(f"Loaded BI report from cache: {cache_file}")
                return report
        except Exception as e:
            logger.warning(f"Failed to load report from cache: {e}")
        
        return None
    
    @staticmethod
    def clear_cache(file_path: str) -> None:
        """Clear cache for a specific file"""
        cache_dir = AnalysisCache.get_cache_dir(file_path)
        if cache_dir.exists():
            import shutil
            shutil.rmtree(cache_dir)
            logger.info(f"Cleared cache: {cache_dir}")

class DataPreprocessingAgent:
    """Intelligent agent for preprocessing datasets used in the RAG system."""
    
    def __init__(self, settings: Optional[Dict[str, Any]] = None):
        """
        Initialize the preprocessing agent with optional settings.
        
        Args:
            settings: Dictionary containing preprocessing configuration options
                     - impute_strategy: Strategy for handling missing values ('mean', 'median', 'most_frequent', 'constant')
                     - encoding_method: Method for encoding categorical variables ('label', 'onehot')
                     - handle_outliers: Whether to remove outliers using IQR method (bool)
                     - scaling_method: Method for scaling numerical features ('standard', 'minmax', None)
        """
        self.settings = settings or {
            'impute_strategy': 'mean',
            'encoding_method': 'label',
            'handle_outliers': True,
            'scaling_method': 'standard'
        }
        self.transformers = {}
        self.feature_stats = {}
        self.preprocessing_summary = []
        self.original_features = []  # Add this to track original features
        
    def preprocess(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Main preprocessing function that applies all preprocessing steps.
        
        Args:
            df: Input DataFrame to preprocess
            
        Returns:
            Preprocessed DataFrame
        """
        logger.info("Starting data preprocessing pipeline...")
        self.preprocessing_summary = []
        
        # Store original features
        self.original_features = df.columns.tolist()
        
        # Make a copy to avoid modifying the original
        df = df.copy()
        
        # Step 1: Clean column names
        df = self._clean_column_names(df)
        
        # Step 2: Handle missing values
        df = self._handle_missing_values(df)
        
        # Step 3: Handle outliers if enabled
        if self.settings['handle_outliers']:
            df = self._handle_outliers(df)
        
        # Step 4: Encode categorical variables
        df = self._encode_categorical_features(df)
        
        # Step 5: Scale numerical features if enabled
        if self.settings['scaling_method']:
            df = self._scale_numerical_features(df)
        
        # Step 6: Generate derived features
        df = self._generate_derived_features(df)
        
        logger.info("Data preprocessing completed successfully")
        return df
    
    def _clean_column_names(self, df: pd.DataFrame) -> pd.DataFrame:
        """Standardize column names to lowercase and replace spaces with underscores."""
        original_cols = df.columns.tolist()
        new_cols = [re.sub(r'[^a-zA-Z0-9_]', '_', col.lower().strip()) for col in original_cols]
        df.columns = new_cols
        
        changes = [f"{old} -> {new}" for old, new in zip(original_cols, new_cols) if old != new]
        if changes:
            self.preprocessing_summary.append(f"Standardized {len(changes)} column names")
            logger.info(f"Column name changes: {', '.join(changes)}")
        
        return df
    
    def _handle_missing_values(self, df: pd.DataFrame) -> pd.DataFrame:
        """Handle missing values using the specified strategy."""
        missing_stats = df.isnull().sum()
        cols_with_missing = missing_stats[missing_stats > 0]
        
        if cols_with_missing.empty:
            return df
        
        # Identify columns that are completely empty (all NaN)
        completely_empty_cols = missing_stats[missing_stats == len(df)]
        cols_with_some_data = cols_with_missing[missing_stats[cols_with_missing.index] < len(df)]
        
        # Drop completely empty columns
        if not completely_empty_cols.empty:
            df = df.drop(columns=completely_empty_cols.index)
            logger.info(f"Dropped completely empty columns: {', '.join(completely_empty_cols.index)}")
            self.preprocessing_summary.append(f"Dropped {len(completely_empty_cols)} completely empty columns")
            
        numerical_cols = df.select_dtypes(include=['int64', 'float64']).columns.tolist()
        categorical_cols = df.select_dtypes(include=['object', 'category']).columns.tolist()
        
        # Filter to only columns with missing data
        numerical_cols_to_impute = [col for col in numerical_cols if col in cols_with_some_data.index]
        categorical_cols_to_impute = [col for col in categorical_cols if col in cols_with_some_data.index]
        
        # Handle numerical columns
        if numerical_cols_to_impute:
            num_imputer = SimpleImputer(strategy=self.settings['impute_strategy'])
            df[numerical_cols_to_impute] = num_imputer.fit_transform(df[numerical_cols_to_impute])
            self.transformers['numerical_imputer'] = num_imputer
        
        # Handle categorical columns
        if categorical_cols_to_impute:
            cat_imputer = SimpleImputer(strategy='most_frequent')
            df[categorical_cols_to_impute] = cat_imputer.fit_transform(df[categorical_cols_to_impute])
            self.transformers['categorical_imputer'] = cat_imputer
        
        self.preprocessing_summary.append(
            f"Imputed missing values in {len(cols_with_some_data)} columns using {self.settings['impute_strategy']} strategy"
        )
        return df
    
    def _handle_outliers(self, df: pd.DataFrame) -> pd.DataFrame:
        """Remove outliers using the IQR method."""
        numerical_cols = df.select_dtypes(include=['int64', 'float64']).columns
        original_rows = len(df)
        
        for col in numerical_cols:
            Q1 = df[col].quantile(0.25)
            Q3 = df[col].quantile(0.75)
            IQR = Q3 - Q1
            lower_bound = Q1 - 1.5 * IQR
            upper_bound = Q3 + 1.5 * IQR
            df = df[(df[col] >= lower_bound) & (df[col] <= upper_bound)]
        
        rows_removed = original_rows - len(df)
        if rows_removed > 0:
            self.preprocessing_summary.append(f"Removed {rows_removed} outlier rows using IQR method")
        
        return df
    
    def _encode_categorical_features(self, df: pd.DataFrame) -> pd.DataFrame:
        """Encode categorical variables using the specified method."""
        categorical_cols = df.select_dtypes(include=['object', 'category']).columns
        
        if categorical_cols.empty:
            return df
            
        if self.settings['encoding_method'] == 'label':
            for col in categorical_cols:
                le = LabelEncoder()
                df[col] = le.fit_transform(df[col])
                self.transformers[f'label_encoder_{col}'] = le
                
            self.preprocessing_summary.append(
                f"Applied Label Encoding to {len(categorical_cols)} categorical columns"
            )
        else:  # onehot encoding
            ohe = OneHotEncoder(sparse_output=False, handle_unknown='ignore')
            encoded_features = ohe.fit_transform(df[categorical_cols])
            feature_names = ohe.get_feature_names_out(categorical_cols)
            
            # Create new dataframe with encoded features
            encoded_df = pd.DataFrame(
                encoded_features,
                columns=feature_names,
                index=df.index
            )
            
            # Drop original categorical columns and concatenate encoded ones
            df = pd.concat([df.drop(columns=categorical_cols), encoded_df], axis=1)
            self.transformers['onehot_encoder'] = ohe
            
            self.preprocessing_summary.append(
                f"Applied One-Hot Encoding to {len(categorical_cols)} categorical columns"
            )
        
        return df
    
    def _scale_numerical_features(self, df: pd.DataFrame) -> pd.DataFrame:
        """Scale numerical features using the specified method."""
        numerical_cols = df.select_dtypes(include=['int64', 'float64']).columns
        
        if numerical_cols.empty:
            return df
            
        scaler = StandardScaler()
        df[numerical_cols] = scaler.fit_transform(df[numerical_cols])
        self.transformers['scaler'] = scaler
        
        self.preprocessing_summary.append(
            f"Scaled {len(numerical_cols)} numerical columns using {self.settings['scaling_method']}"
        )
        return df
    
    def _generate_derived_features(self, df: pd.DataFrame) -> pd.DataFrame:
        """Generate derived features based on the data types and patterns in the dataset."""
        # Handle datetime columns
        date_cols = df.select_dtypes(include=['datetime64']).columns
        for col in date_cols:
            df[f'{col}_year'] = df[col].dt.year
            df[f'{col}_month'] = df[col].dt.month
            df[f'{col}_day'] = df[col].dt.day
            df[f'{col}_dayofweek'] = df[col].dt.dayofweek
            
        if date_cols.any():
            self.preprocessing_summary.append(
                f"Generated temporal features from {len(date_cols)} datetime columns"
            )
        
        return df
    
    def get_preprocessing_summary(self) -> List[str]:
        """Return a summary of all preprocessing steps applied."""
        return self.preprocessing_summary
    
    def get_feature_statistics(self) -> Dict[str, Any]:
        """Return statistics about the features after preprocessing."""
        return self.feature_stats

    def get_original_features(self) -> List[str]:
        """Return the list of original features before preprocessing."""
        return self.original_features

class MarketAnalysisApp:
    def __init__(self, file_path=None):
        self.app = Flask(__name__)
        self.configure_app()
        self.initialize_ai()
        self.preprocessing_agent = DataPreprocessingAgent()  # Initialize the preprocessing agent
        if file_path:
            self.initialize_dataset(file_path)
        self.table = None  # Add this line to store the table

    def configure_app(self):
        """Configure Flask application settings"""
        self.app.config.update(
            SESSION_TYPE="filesystem",
            SECRET_KEY=os.urandom(24),
            TEMPLATES_AUTO_RELOAD=True
        )
        Session(self.app)

    def initialize_ai(self):
        """Initialize the Gemini AI model"""
        GEMINI_API_KEY = os.getenv('GEMINI_API_KEY')
        
        if not GEMINI_API_KEY:
            raise ValueError(
                "GEMINI_API_KEY not found. Please set it in the .env file. "
                "Get your free API key at: https://aistudio.google.com/app/apikey"
            )
        
        genai.configure(api_key=GEMINI_API_KEY)
        logger.info("Gemini AI model initialized successfully")
        
        self.generation_config = {
            "temperature": 0.7,
            "top_p": 0.95,
            "top_k": 64,
            "max_output_tokens": 2048,
        }
        
        self.model = genai.GenerativeModel(
            model_name="gemini-2.0-flash",
            generation_config=self.generation_config
        )

    def initialize_dataset(self, file_path):
        """Initialize dataset manager and preprocess the data"""
        try:
            self.dataset_manager = DatasetManager(file_path)
            
            # Preprocess the dataset
            if self.dataset_manager.data is not None:
                logger.info("Starting dataset preprocessing...")
                self.dataset_manager.data = self.preprocessing_agent.preprocess(self.dataset_manager.data)
                
                # Log preprocessing summary
                summary = self.preprocessing_agent.get_preprocessing_summary()
                logger.info("Preprocessing Summary:")
                for step in summary:
                    logger.info(f"- {step}")
                
                # Store feature statistics
                self.feature_stats = self.preprocessing_agent.get_feature_statistics()
                logger.info("Dataset preprocessing completed successfully")
            else:
                logger.warning("No dataset available for preprocessing")
                
        except Exception as e:
            logger.error(f"Error during dataset initialization and preprocessing: {str(e)}")
            raise

    def analyze_feature_relationships(self) -> List[Dict[str, Any]]:
        """Get feature relationship analysis from AI model (with caching)"""
        df = self.dataset_manager.data
        if df is None:
            logger.error("No dataset available")
            return []

        # Check cache first
        cached_relationships = AnalysisCache.load_relationships(self.dataset_manager.file_path)
        if cached_relationships is not None:
            logger.info("✅ Loaded relationships from cache (skipping API call)")
            console.print("[green]✅ Loaded relationships from cache (skipping API call)[/green]")
            return cached_relationships

        try:
            # Create features description
            features_description = self._get_features_description(df)
            logger.info("Generated features description")
            
            # Create prompt and get response
            prompt = self._create_relationship_prompt(features_description)
            logger.info(f"Sending prompt to model")
            
            # Get AI response
            chat = self.model.start_chat(history=[])
            response = chat.send_message(prompt)
            
            if not response or not response.text:
                logger.error("Received empty response from model")
                return []
                
            raw_response = response.text.strip()
            logger.info(f"Raw response from model: {raw_response}")
            
            # First try structured parsing
            relationships = self._parse_relationships_response(raw_response)
            
            # If no relationships found, try alternative parsing
            if not relationships:
                relationships = self._parse_unstructured_response(raw_response)
            
            # Save to cache for future use
            if relationships:
                AnalysisCache.save_relationships(self.dataset_manager.file_path, relationships)
                
            return relationships
            
        except Exception as e:
            logger.error(f"Error in relationship analysis: {str(e)}")
            return []

    def _get_features_description(self, df: pd.DataFrame) -> str:
        """Create a description of the dataset features and their basic statistics"""
        feature_info = []
        
        for col in df.columns:
            if pd.api.types.is_numeric_dtype(df[col]):
                stats = {
                    'min': float(df[col].min()),
                    'max': float(df[col].max()),
                    'mean': float(df[col].mean()),
                    'std': float(df[col].std()),
                    'nulls': int(df[col].isnull().sum()),
                    'type': 'numeric',
                    'sample_values': [float(x) for x in df[col].head(3).tolist()]
                }
            else:
                stats = {
                    'unique_values': int(df[col].nunique()),
                    'top_values': {str(k): int(v) for k, v in df[col].value_counts().nlargest(3).to_dict().items()},
                    'nulls': int(df[col].isnull().sum()),
                    'type': 'categorical',
                    'sample_values': [str(x) for x in df[col].head(3).tolist()]
                }
            
            feature_info.append({
                'name': str(col),
                'stats': stats
            })
            
        return json.dumps(feature_info, indent=2)

    def _create_relationship_prompt(self, features_description: str) -> str:
        """Create prompt for AI relationship analysis"""
        sample_data = self.dataset_manager.data.head().to_string()
        
        return f"""You are a data analyst examining a dataset. Here is the dataset description and first few rows:

Sample Data:
{sample_data}

Please analyze the dataset and list the most important relationships between features. Return ONLY the relationships in this exact format, with one relationship per line:

- Feature1 | Feature2 | Type | Description

Guidelines:
1. Only list strong and significant relationships
2. Each line must start with a hyphen
3. Use pipe symbol (|) to separate the four parts
4. Keep descriptions clear and concise

Example format:
- Price | Size | Positive Correlation | Larger items have higher prices
- Category | Sales | Category Impact | Luxury items have 50% higher sales

Please provide at least 3-5 important relationships you find in the data. Return ONLY the relationship list, no other text."""

    def _parse_relationships_response(self, response: str) -> List[Dict[str, Any]]:
        """Parse structured response into relationships"""
        relationships = []
        
        for line in response.split('\n'):
            line = line.strip()
            if not line or not line.startswith('-'):
                continue
                
            # Remove leading hyphen and split by pipe
            parts = [part.strip() for part in line.strip('- ').split('|')]
            
            if len(parts) >= 4:
                relationship = {
                    'feature1': parts[0],
                    'feature2': parts[1],
                    'type': parts[2],
                    'description': parts[3]
                }
                relationships.append(relationship)
                logger.info(f"Parsed relationship: {relationship}")
        
        return relationships

    def _parse_unstructured_response(self, response: str) -> List[Dict[str, Any]]:
        """Parse less structured responses to extract relationships"""
        relationships = []
        
        # Split into sentences
        sentences = [s.strip() for s in response.replace('\n', ' ').split('.')]
        
        for sentence in sentences:
            # Look for feature names in the sentence
            features = []
            for col in self.dataset_manager.data.columns:
                if str(col) in sentence:
                    features.append(str(col))
                    
            if len(features) >= 2:
                # Try to determine relationship type
                type_keywords = {
                    'correlation': ['correlate', 'correlation', 'associated', 'relationship'],
                    'impact': ['impact', 'affect', 'influence', 'effect'],
                    'difference': ['difference', 'vary', 'variation', 'different'],
                    'pattern': ['pattern', 'trend', 'tendency']
                }
                
                rel_type = 'relationship'
                for type_name, keywords in type_keywords.items():
                    if any(keyword in sentence.lower() for keyword in keywords):
                        rel_type = type_name
                        break
                
                relationship = {
                    'feature1': features[0],
                    'feature2': features[1],
                    'type': rel_type.title(),
                    'description': sentence.strip()
                }
                relationships.append(relationship)
                logger.info(f"Extracted relationship from unstructured text: {relationship}")
                
        
        return relationships

    def display_results(self, relationships: List[Dict[str, Any]]):
        """Display formatted results using Rich"""
        console.print("\n[bold blue]Market Analysis Results[/bold blue]", justify="center")
        console.print("=" * 80, justify="center")

        # Display dataset summary
        self.display_dataset_summary()

        # Display relationships
        console.print("\n[bold green]Key Feature Relationships[/bold green]")
        
        if not relationships:
            console.print("[yellow]No significant relationships were found. This could mean:[/yellow]")
            console.print("- The dataset doesn't contain strong feature relationships")
            console.print("- The AI model needs a different approach to analyze the data")
            console.print("- There might be an issue with the analysis process")
            return

        table = Table(title="Important Relationships Identified")
        table.add_column("Features", style="cyan", width=30)
        table.add_column("Type", style="yellow", width=20)
        table.add_column("Description", style="magenta", width=50)

        for rel in relationships:
            table.add_row(
                f"{rel['feature1']} → {rel['feature2']}",
                rel['type'],
                rel['description']
            )

        self.table = table  # Store the table in the instance
        console.print(table)
        console.print(f"\n[dim]Analysis generated at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}[/dim]")

    def store_table(self):
        """Store table in a Python file for import"""
        if self.table:
            with open("analysis_results.py", "w") as f:
                f.write("table = '''" + str(self.table) + "'''\n")
            logger.info("Table stored successfully in analysis_results.py")
        else:
            logger.warning("No table to store")

    def display_dataset_summary(self):
        """Display dataset summary statistics"""
        df = self.dataset_manager.data
        
        table = Table(title="Dataset Summary")
        table.add_column("Metric", style="cyan")
        table.add_column("Value", style="magenta")

        table.add_row("Total Records", str(len(df)))
        table.add_row("Total Features", str(len(df.columns)))
        table.add_row("Feature Names", ", ".join(df.columns.tolist()))
        
        #console.print(table)

    def _create_bi_report_prompt(self, features_description: str) -> str:
        """Create prompt for AI to generate a comprehensive BI report"""
        sample_data = self.dataset_manager.data.head().to_string()
        
        return f"""You are a senior Business Intelligence analyst creating a comprehensive report. Using the dataset information below, generate a well-structured BI report.

Sample Data:
{sample_data}

Please generate a complete BI report in the following Markdown format:

# Market Analysis Report
[Current Date]

## Executive Summary
[Provide a concise summary of key findings]

## Dataset Overview
- Total Records: [number]
- Time Period: [start_date to end_date]
- Key Metrics Analyzed: [list]

## Key Performance Indicators (KPIs)
[List and explain main KPIs]

## Feature Analysis
[For each important feature, provide detailed analysis]

## Relationship Analysis
[Previous analysis will be inserted here]

## Market Trends
[Identify and describe key trends]

## [CHARTS_PLACEHOLDER]
The following charts will be generated separately:
1. Feature Correlation Heatmap
2. Time Series Analysis
3. Distribution Analysis
4. Category Comparison Charts

## Recommendations
[Provide data-driven recommendations]

## Technical Documentation
### Data Processing Notes
- Data Quality: [assessment]
- Missing Values: [handling method]
- Outliers: [treatment approach]

### Methodology
[Explain analysis methods used]

### Limitations and Assumptions
[List key limitations and assumptions]

Generate ONLY the report content following this structure exactly. The [CHARTS_PLACEHOLDER] section will be populated with actual visualizations later."""

    def generate_bi_report(self) -> str:
        """Generate a comprehensive BI report (with caching)"""
        try:
            # Check cache first
            cached_report = AnalysisCache.load_report(self.dataset_manager.file_path)
            if cached_report is not None:
                logger.info("✅ Loaded BI report from cache (skipping API call)")
                console.print("[green]✅ Loaded BI report from cache (skipping API call)[/green]")
                return cached_report
            
            # Get feature description
            features_description = self._get_features_description(self.dataset_manager.data)
            
            # Create and send prompt
            prompt = self._create_bi_report_prompt(features_description)
            chat = self.model.start_chat(history=[])
            response = chat.send_message(prompt)
            
            if not response or not response.text:
                logger.error("Received empty response for BI report")
                return "Error generating BI report"
                
            report = response.text.strip()
            logger.info("Successfully generated BI report")
            
            # Save to cache for future use
            AnalysisCache.save_report(self.dataset_manager.file_path, report)
            
            return report
            
        except Exception as e:
            logger.error(f"Error generating BI report: {str(e)}")
            return f"Error generating BI report: {str(e)}"

    def display_preprocessing_results(self):
        """Display preprocessing results using Rich"""
        console.print("\n[bold blue]Data Preprocessing Results[/bold blue]", justify="center")
        console.print("=" * 80, justify="center")

        # Display preprocessing summary
        if self.preprocessing_agent.preprocessing_summary:
            table = Table(title="Preprocessing Steps")
            table.add_column("Step", style="cyan")
            table.add_column("Details", style="magenta")
            
            for i, step in enumerate(self.preprocessing_agent.preprocessing_summary, 1):
                table.add_row(f"Step {i}", step)
            console.print(table)
        
        # Display dataset information
        if self.dataset_manager and self.dataset_manager.data is not None:
            data_info = self.dataset_manager.get_data_info()
            
            info_table = Table(title="Dataset Information")
            info_table.add_column("Metric", style="cyan")
            info_table.add_column("Value", style="magenta")
            
            info_table.add_row("Number of Rows", str(data_info['shape'][0]))
            info_table.add_row("Number of Original Features", str(len(self.preprocessing_agent.get_original_features())))
            info_table.add_row("Number of Processed Features", str(data_info['shape'][1]))
            info_table.add_row("Memory Usage", f"{data_info['memory_usage'] / 1024 / 1024:.2f} MB")
            
            # Display original features
            original_features = self.preprocessing_agent.get_original_features()
            info_table.add_row("Original Features", ", ".join(original_features))
            
            # Display column types summary
            dtype_counts = pd.Series(data_info['dtypes']).value_counts()
            dtype_summary = ", ".join([f"{dtype}: {count}" for dtype, count in dtype_counts.items()])
            info_table.add_row("Column Types", dtype_summary)
            
            # Display missing values summary if any
            missing_cols = {k: v for k, v in data_info['missing_values'].items() if v > 0}
            if missing_cols:
                missing_summary = ", ".join([f"{k}: {v}" for k, v in missing_cols.items()])
                info_table.add_row("Missing Values", missing_summary)
            else:
                info_table.add_row("Missing Values", "None")
            
            console.print(info_table)
        
        console.print(f"\n[dim]Preprocessing completed at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}[/dim]")

    def run_analysis(self):
        """Run complete analysis including preprocessing, relationships and BI report"""
        # Run preprocessing and display results
        console.print("\n[bold blue]Running Data Preprocessing...[/bold blue]")
        self.display_preprocessing_results()
        
        # Get relationships
        relationships = self.analyze_feature_relationships()
        self.display_results(relationships)
        
        # Generate BI report
        console.print("\n[bold blue]Generating BI Report...[/bold blue]")
        report = self.generate_bi_report()
        
        # Display report in console
        console.print("\n[bold green]BI Report Generated[/bold green]")
        console.print(Panel(report, title="BI Report", border_style="blue"))
        
        return relationships, report

class DatasetManager:
    def __init__(self, file_path):
        self.file_path = file_path
        self.data = None
        self.original_data = None  # Store original unprocessed data
        self.preprocessing_settings = None  # Store preprocessing settings
        self.load_data()

    def load_data(self):
        """Load and validate dataset with encoding detection"""
        encodings = ['utf-8', 'latin-1', 'cp1252', 'iso-8859-1', 'utf-16', 'ascii']
        
        for encoding in encodings:
            try:
                self.data = pd.read_csv(self.file_path, quotechar='"', encoding=encoding)
                self.original_data = self.data.copy()  # Keep a copy of original data
                logger.info(f"Dataset loaded successfully with {encoding} encoding")
                self._log_initial_dataset_info()
                return
            except (UnicodeDecodeError, UnicodeError) as e:
                logger.debug(f"Failed to load with {encoding} encoding: {e}")
                continue
            except Exception as e:
                # For non-encoding errors, raise immediately
                logger.error(f"Error loading dataset: {e}")
                raise
        
        # If we get here, none of the encodings worked
        logger.error(f"Failed to load file with any of the supported encodings: {encodings}")
        raise ValueError(f"Could not decode file '{self.file_path}' with any supported encoding")

    def _log_initial_dataset_info(self):
        """Log initial dataset information"""
        if self.data is not None:
            logger.info(f"Dataset shape: {self.data.shape}")
            logger.info(f"Columns: {', '.join(self.data.columns)}")
            logger.info(f"Data types:\n{self.data.dtypes}")
            
            # Log missing values information
            missing = self.data.isnull().sum()
            if missing.any():
                logger.info("Missing values per column:")
                for col, count in missing[missing > 0].items():
                    logger.info(f"- {col}: {count} missing values")

    def reset_to_original(self):
        """Reset the dataset to its original unprocessed state"""
        if self.original_data is not None:
            self.data = self.original_data.copy()
            logger.info("Dataset reset to original state")
        else:
            logger.warning("No original data available to reset to")

    def update_preprocessing_settings(self, settings: Dict[str, Any]):
        """Update preprocessing settings"""
        self.preprocessing_settings = settings
        logger.info(f"Updated preprocessing settings: {settings}")

    def get_data_info(self) -> Dict[str, Any]:
        """Get information about the current state of the dataset"""
        if self.data is None:
            return {}
            
        info = {
            'shape': self.data.shape,
            'columns': self.data.columns.tolist(),
            'dtypes': self.data.dtypes.to_dict(),
            'missing_values': self.data.isnull().sum().to_dict(),
            'memory_usage': self.data.memory_usage(deep=True).sum()
        }
        return info

def main():
    """Main function to run the analysis"""
    try:
        # Prompt user for CSV file path
        file_path = input("Please enter the path to your CSV file: ")
        
        # Initialize the MarketAnalysisApp with the user-provided file path
        app = MarketAnalysisApp(file_path)
        
        console.print("\n[bold yellow]Welcome to Market Analysis System[/bold yellow]", justify="center")
        console.print("[dim]Starting comprehensive analysis...[/dim]\n")

        # Run complete analysis
        relationships, report = app.run_analysis()

        # Save results
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        results = {
            'relationships': relationships,
            'timestamp': timestamp
        }
        
        with open(f'relationship_analysis_{timestamp}.json', 'w') as f:
            json.dump(results, f, indent=2)
        console.print(f"\n[green]Results saved to relationship_analysis_{timestamp}.json[/green]")

        # Save table for import in another code
        with open("../table.py", "w") as f:
            f.write("table = '''" + str(app.table) + "'''")
        console.print(f"\n[green]Table saved to ../table.py[/green]")
        
        # Store the table correctly
        app.store_table()
        
    except Exception as e:
        logger.error(f"Error in main execution: {str(e)}")
        console.print(f"\n[red]Error: {str(e)}[/red]")
        console.print("[yellow]Please check the logs for more details.[/yellow]")

if __name__ == '__main__':
    if len(sys.argv) > 1 and sys.argv[1] == 'cli':
        main()
    else:
        # Initialize the Flask app
        app = Flask(__name__)

        @app.route('/api/preprocess', methods=['POST'])
        def preprocess_data():
            """Endpoint to preprocess data."""
            data = request.json.get('data')
            if not data:
                return jsonify({'error': 'No data provided'}), 400
            
            df = pd.DataFrame(data)
            preprocessed_df = preprocessing_agent.preprocess(df)
            return jsonify(preprocessed_df.to_dict(orient='records'))

        @app.route('/api/analyze', methods=['POST'])
        def analyze_data():
            """Endpoint to run market analysis."""
            data = request.json.get('data')
            if not data:
                return jsonify({'error': 'No data provided'}), 400
            
            df = pd.DataFrame(data)
            market_analysis_app.dataset_manager.data = df
            relationships, report = market_analysis_app.run_analysis()
            return jsonify({
                'relationships': relationships,
                'report': report
            })

        app.run(debug=True)