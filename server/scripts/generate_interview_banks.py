import os
import json
import uuid

BANKS_DIR = os.path.join(os.path.dirname(__file__), '..', 'app', 'data', 'interview_questions')

def generate_questions():
    os.makedirs(BANKS_DIR, exist_ok=True)
    
    domains = {
        "full_stack": [
            ("Explain how you would design authentication for a React and Node.js application.", ["React", "Node.js", "Authentication"]),
            ("How do you manage global state in a complex React application?", ["React", "State Management"]),
            ("Describe the process of optimizing a slow API endpoint in Express.", ["Node.js", "Express", "Performance"]),
            ("How do you handle database migrations in a production environment?", ["Database", "SQL", "Deployment"]),
            ("What are the security implications of storing JWTs in localStorage vs HTTP-only cookies?", ["Security", "JWT"]),
            ("Explain the difference between SSR and CSR and when to use each.", ["React", "Next.js", "Architecture"]),
            ("How do you implement CI/CD for a full-stack JavaScript application?", ["DevOps", "CI/CD"]),
            ("Describe a challenging bug you fixed that spanned across both frontend and backend.", ["Debugging", "Full Stack"]),
            ("How do you ensure data consistency in a distributed system?", ["Architecture", "Databases"]),
            ("Explain the concept of WebSockets and a use case for them.", ["WebSockets", "Real-time"])
        ],
        "frontend": [
            ("What are the key considerations for building an accessible (a11y) web application?", ["HTML", "Accessibility"]),
            ("Explain the CSS Box Model and the difference between content-box and border-box.", ["CSS"]),
            ("How do you optimize the Critical Rendering Path?", ["Performance", "Browser"]),
            ("Describe the React component lifecycle and how hooks map to it.", ["React", "Hooks"]),
            ("What strategies do you use for responsive design without relying heavily on frameworks?", ["CSS", "Responsive Design"]),
            ("Explain the concept of 'memoization' in React and when it is actually necessary.", ["React", "Performance"]),
            ("How do you handle forms and validation in React?", ["React", "Forms"]),
            ("What is the Virtual DOM and how does React's reconciliation algorithm work?", ["React", "Virtual DOM"]),
            ("Describe your approach to testing frontend components.", ["Testing", "Jest", "React Testing Library"]),
            ("How do you manage complex CSS architectures at scale?", ["CSS", "SASS", "CSS-in-JS"])
        ],
        "backend": [
            ("Explain the CAP theorem and its implications for database selection.", ["Databases", "Architecture"]),
            ("How would you design a rate limiter for a public API?", ["System Design", "API"]),
            ("Describe the differences between REST and GraphQL.", ["API", "REST", "GraphQL"]),
            ("What is indexing in a database and how does it affect read vs write operations?", ["SQL", "Databases"]),
            ("Explain how you would implement horizontal scaling for a stateless backend service.", ["Scaling", "DevOps"]),
            ("How do you handle background jobs and message queues?", ["Queues", "Redis", "RabbitMQ"]),
            ("Describe a strategy for securing a backend against common OWASP vulnerabilities.", ["Security", "OWASP"]),
            ("What is the N+1 query problem and how do you resolve it?", ["ORM", "SQL", "Performance"]),
            ("Explain the concept of microservices versus a monolithic architecture.", ["Architecture", "Microservices"]),
            ("How do you handle API versioning?", ["API", "Architecture"])
        ],
        "ai_ml": [
            ("Explain the difference between supervised and unsupervised learning.", ["Machine Learning", "Concepts"]),
            ("How do you handle imbalanced datasets in classification tasks?", ["Data Science", "Machine Learning"]),
            ("Describe the architecture of a standard Transformer model.", ["Deep Learning", "NLP"]),
            ("What is overfitting and how do you prevent it?", ["Machine Learning", "Model Training"]),
            ("Explain the vanishing gradient problem and how LSTMs or ResNets address it.", ["Deep Learning"]),
            ("How would you deploy a machine learning model to production?", ["MLOps", "Deployment"]),
            ("Describe the trade-offs between precision and recall.", ["Evaluation", "Metrics"]),
            ("What is Transfer Learning and when is it most effective?", ["Deep Learning", "Transfer Learning"]),
            ("Explain how RAG (Retrieval-Augmented Generation) works.", ["NLP", "LLMs"]),
            ("How do you approach hyperparameter tuning?", ["Machine Learning", "Optimization"])
        ],
        "data": [
            ("Explain the difference between a Data Warehouse and a Data Lake.", ["Data Engineering", "Architecture"]),
            ("How do you approach designing an ETL pipeline?", ["ETL", "Data Engineering"]),
            ("Describe the differences between row-oriented and column-oriented databases.", ["Databases", "Performance"]),
            ("What is data normalization and when might you intentionally denormalize?", ["SQL", "Database Design"]),
            ("Explain the concept of a Star Schema.", ["Data Modeling"]),
            ("How do you handle real-time streaming data vs batch processing?", ["Streaming", "Data Engineering"]),
            ("What window functions in SQL do you find most useful and why?", ["SQL", "Analytics"]),
            ("Describe your approach to data quality and testing.", ["Data Quality", "Testing"]),
            ("How do you optimize slow analytical queries?", ["SQL", "Performance"]),
            ("Explain the MapReduce paradigm.", ["Big Data", "Hadoop"])
        ],
        "mobile": [
            ("Explain the difference between native and cross-platform mobile development.", ["Mobile", "Architecture"]),
            ("How do you handle offline capabilities and data syncing in a mobile app?", ["Mobile", "Offline"]),
            ("Describe the mobile application lifecycle and how to handle background tasks.", ["Mobile", "Lifecycle"]),
            ("What are the key considerations for optimizing mobile app performance?", ["Performance", "Mobile"]),
            ("Explain how you approach mobile UI responsiveness across different device sizes.", ["UI", "Responsive"]),
            ("How do you securely store sensitive data on a mobile device?", ["Security", "Mobile"]),
            ("Describe the process of publishing an app to the App Store or Google Play.", ["Deployment", "App Stores"]),
            ("What are the differences between State and Props in React Native?", ["React Native"]),
            ("How do you handle navigation in a complex mobile application?", ["Navigation", "Mobile"]),
            ("Explain how push notifications work end-to-end.", ["Push Notifications", "Architecture"])
        ],
        "general": [
            ("Describe a time you had to learn a new technology quickly to solve a problem.", ["Problem Solving", "Learning"]),
            ("How do you approach debugging a complex issue in a system you didn't build?", ["Debugging", "Problem Solving"]),
            ("Explain how you prioritize technical debt versus building new features.", ["Technical Debt", "Prioritization"]),
            ("Describe a situation where you disagreed with a technical decision made by your team.", ["Communication", "Teamwork"]),
            ("How do you ensure the code you write is maintainable by others?", ["Code Quality", "Maintainability"]),
            ("Explain a complex technical concept to a non-technical stakeholder.", ["Communication", "Soft Skills"]),
            ("Describe your workflow for reviewing a peer's Pull Request.", ["Code Review", "Collaboration"]),
            ("How do you stay updated with the rapid changes in software engineering?", ["Continuous Learning"]),
            ("Describe a project that failed and what you learned from it.", ["Failure", "Learning"]),
            ("What is your approach to estimating the time required for a development task?", ["Estimation", "Agile"])
        ]
    }
    
    for domain, qs in domains.items():
        bank = []
        for i, (q_text, skills) in enumerate(qs):
            bank.append({
                "id": f"{domain}_q_{i+1:03d}",
                "domain": domain,
                "skills": skills,
                "difficulty": "medium",
                "question": q_text
            })
            
        filepath = os.path.join(BANKS_DIR, f"{domain}.json")
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(bank, f, indent=2)
            
    print(f"Generated {len(domains)} interview question banks in {BANKS_DIR}")

if __name__ == '__main__':
    generate_questions()
