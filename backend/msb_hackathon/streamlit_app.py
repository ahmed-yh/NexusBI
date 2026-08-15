import streamlit as st
import pandas as pd
from charts_predict import MarketAnalysisApp, DatasetManager
from rich.console import Console
import sys
from io import StringIO
import json
from datetime import datetime
import plotly.express as px
import plotly.graph_objects as go
import numpy as np

# Configure page settings
st.set_page_config(
    page_title="Market Analysis System",
    page_icon="📊",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Custom CSS
st.markdown("""
    <style>
    .main {
        padding: 2rem;
    }
    .stButton>button {
        width: 100%;
        margin-top: 1rem;
    }
    .report-box {
        background-color: #f0f2f6;
        border-radius: 10px;
        padding: 20px;
        margin: 10px 0;
    }
    </style>
""", unsafe_allow_html=True)

class StreamlitConsole(Console):
    """Custom console class to redirect Rich output to Streamlit"""
    def __init__(self):
        super().__init__(file=StringIO())
        
    def print(self, *args, **kwargs):
        super().print(*args, **kwargs)
        output = self.file.getvalue()
        if output:
            st.text(output)
            self.file.seek(0)
            self.file.truncate(0)

def create_visualizations(df):
    """Create various visualizations using Plotly"""
    visualizations = []
    
    # 1. Correlation Heatmap for numeric columns
    numeric_cols = df.select_dtypes(include=['int64', 'float64']).columns
    if len(numeric_cols) > 1:
        corr_matrix = df[numeric_cols].corr()
        fig = go.Figure(data=go.Heatmap(
            z=corr_matrix,
            x=corr_matrix.columns,
            y=corr_matrix.columns,
            colorscale='RdBu'
        ))
        fig.update_layout(title='Feature Correlation Heatmap')
        visualizations.append(("Correlation Heatmap", fig))
    
    # 2. Distribution plots for numeric columns
    for col in numeric_cols:
        fig = go.Figure(data=[go.Histogram(x=df[col], nbinsx=30)])
        fig.update_layout(title=f'Distribution of {col}')
        visualizations.append((f"Distribution of {col}", fig))
    
    # 3. Box plots for numeric columns
    fig = go.Figure()
    for col in numeric_cols:
        fig.add_trace(go.Box(y=df[col], name=col))
    fig.update_layout(title='Box Plots of Numeric Features')
    visualizations.append(("Box Plots", fig))
    
    # 4. Categorical value counts
    categorical_cols = df.select_dtypes(include=['object', 'category']).columns
    for col in categorical_cols:
        value_counts = df[col].value_counts()
        fig = go.Figure(data=[go.Bar(x=value_counts.index, y=value_counts.values)])
        fig.update_layout(title=f'Value Counts for {col}')
        visualizations.append((f"Value Counts - {col}", fig))
    
    return visualizations

def main():
    st.title("📊 Market Analysis System")
    
    # Sidebar
    st.sidebar.header("Configuration")
    data_source = st.sidebar.selectbox(
        "Select Data Source",
        ["File Upload", "Web Scraping"]
    )
    
    # Initialize app with custom console
    console = StreamlitConsole()
    app = MarketAnalysisApp()
    
    if data_source == "File Upload":
        uploaded_file = st.sidebar.file_uploader("Upload your data file", type=['csv', 'xlsx', 'xls'])
        if uploaded_file:
            try:
                if uploaded_file.name.endswith('.csv'):
                    df = pd.read_csv(uploaded_file)
                else:
                    df = pd.read_excel(uploaded_file)
                
                app.dataset_manager = DatasetManager(df)
                st.success("Data loaded successfully!")
                
                # Display data preview
                st.subheader("Data Preview")
                st.dataframe(df.head())
                
                # Display basic statistics
                st.subheader("Basic Statistics")
                col1, col2, col3 = st.columns(3)
                with col1:
                    st.metric("Number of Records", len(df))
                with col2:
                    st.metric("Number of Features", len(df.columns))
                with col3:
                    st.metric("Missing Values", df.isnull().sum().sum())
                
            except Exception as e:
                st.error(f"Error loading file: {str(e)}")
                return
    
    else:  # Web Scraping
        st.sidebar.subheader("Web Scraping Configuration")
        
        # Add example selector
        example = st.sidebar.selectbox(
            "Choose an example or enter custom URL",
            ["Custom", "Books to Scrape", "Amazon Best Sellers"]
        )
        
        if example == "Books to Scrape":
            url = "http://books.toscrape.com/"
            target_element = "article.product_pod"
            use_selenium = False
            fields = {
                'title': 'h3 a::attr(title)',
                'price': 'p.price_color::text',
                'availability': 'p.availability::text',
                'rating': 'p.star-rating::attr(class)',
                'image': 'div.image_container img::attr(src)'
            }
            next_button = 'li.next a'
        elif example == "Amazon Best Sellers":
            url = "https://www.amazon.com/best-sellers-books-Amazon/zgbs/books/"
            target_element = "div.zg-grid-general-faceout"
            use_selenium = True
            fields = {
                'title': 'div._cDEzb_p13n-sc-css-line-clamp-1_1Fn1y',
                'price': 'span._cDEzb_p13n-sc-price_3mJ9Z',
                'rating': 'span.a-icon-alt',
                'reviews': 'span.a-size-small'
            }
        else:
            url = st.sidebar.text_input("Enter URL")
            target_element = st.sidebar.text_input("CSS Selector for target data")
            use_selenium = st.sidebar.checkbox("Use Selenium for JavaScript")
            fields = {}
            
            # Custom fields input
            st.sidebar.subheader("Field Selectors (Optional)")
            num_fields = st.sidebar.number_input("Number of fields to extract", min_value=0, max_value=10, value=0)
            for i in range(num_fields):
                col1, col2 = st.sidebar.columns(2)
                with col1:
                    field_name = st.text_input(f"Field {i+1} name")
                with col2:
                    field_selector = st.text_input(f"Field {i+1} CSS selector")
                if field_name and field_selector:
                    fields[field_name] = field_selector
        
        num_pages = st.sidebar.number_input("Number of pages to scrape", min_value=1, value=1)
        
        # Display the current configuration
        with st.sidebar.expander("Current Configuration"):
            st.code(f"""
URL: {url}
Target Element: {target_element}
Use Selenium: {use_selenium}
Number of Pages: {num_pages}
Fields: {json.dumps(fields, indent=2)}
            """)
        
        if st.sidebar.button("Start Scraping"):
            try:
                scrape_config = {
                    'url': url,
                    'target_element': target_element,
                    'pages': num_pages,
                    'use_selenium': use_selenium,
                    'fields': fields,
                    'next_button': next_button if example == "Books to Scrape" else None
                }
                
                with st.spinner("Scraping data..."):
                    df = app.web_scraper.scrape(url, scrape_config)
                    
                    if not df.empty:
                        # Clean up the data
                        if 'rating' in df.columns:
                            # Convert rating strings to numeric values
                            rating_map = {
                                'One': 1, 'Two': 2, 'Three': 3, 'Four': 4, 'Five': 5,
                                'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5
                            }
                            df['rating'] = df['rating'].map(rating_map)
                        
                        if 'availability' in df.columns:
                            # Clean up availability text
                            df['availability'] = df['availability'].str.strip()
                            
                        app.dataset_manager = DatasetManager(df)
                        st.success(f"Successfully scraped {len(df)} items!")
                        
                        # Display data preview
                        st.subheader("Scraped Data Preview")
                        st.dataframe(df.head())
                        
                        # Display basic statistics
                        st.subheader("Basic Statistics")
                        col1, col2, col3 = st.columns(3)
                        with col1:
                            st.metric("Number of Records", len(df))
                        with col2:
                            st.metric("Number of Features", len(df.columns))
                        with col3:
                            if 'price' in df.columns:
                                st.metric("Average Price", f"£{df['price'].mean():.2f}")
                            else:
                                st.metric("Missing Values", df.isnull().sum().sum())
                    else:
                        st.error("No data was scraped. Please check the selectors and try again.")
                    
            except Exception as e:
                st.error(f"Error scraping data: {str(e)}")
                return
    
    # Analysis Section
    if hasattr(app, 'dataset_manager') and app.dataset_manager.data is not None:
        st.header("Analysis")
        
        analysis_type = st.selectbox(
            "Select Analysis Type",
            ["Feature Relationships", "BI Report", "Visualizations"]
        )
        
        if analysis_type == "Feature Relationships":
            if st.button("Analyze Feature Relationships"):
                with st.spinner("Analyzing relationships..."):
                    relationships = app.analyze_feature_relationships()
                    
                    if relationships:
                        st.subheader("Key Feature Relationships")
                        for rel in relationships:
                            with st.expander(f"{rel['feature1']} → {rel['feature2']}"):
                                st.write(f"**Type:** {rel['type']}")
                                st.write(f"**Description:** {rel['description']}")
                    else:
                        st.warning("No significant relationships found.")
        
        elif analysis_type == "BI Report":
            if st.button("Generate BI Report"):
                with st.spinner("Generating report..."):
                    report = app.generate_bi_report()
                    
                    if report:
                        st.markdown(report)
                        
                        # Save report button
                        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                        report_filename = f'bi_report_{timestamp}.md'
                        st.download_button(
                            "Download Report",
                            report,
                            file_name=report_filename,
                            mime="text/markdown"
                        )
                    else:
                        st.error("Error generating report.")
        
        else:  # Visualizations
            st.subheader("Data Visualizations")
            visualizations = create_visualizations(app.dataset_manager.data)
            
            for title, fig in visualizations:
                with st.expander(title):
                    st.plotly_chart(fig, use_container_width=True)

if __name__ == "__main__":
    main() 