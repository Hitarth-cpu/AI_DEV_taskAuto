import pyodbc

# Connection parameters
server = 'localhost,1433' # Or just '127.0.0.1'
database = 'master'       # Default database
username = 'sa'           # Default admin user
password = 'YourStrong!Passw0rd'

# Use the default Windows SQL Server driver
driver = '{SQL Server}'

connection_string = f'DRIVER={driver};SERVER={server};DATABASE={database};UID={username};PWD={password}'

try:
    print(f"Attempting to connect to SQL Server at {server}...")
    conn = pyodbc.connect(connection_string, timeout=5)
    
    # Test a simple query
    cursor = conn.cursor()
    cursor.execute("SELECT @@VERSION")
    row = cursor.fetchone()
    
    print("\n✅ CONNECTION SUCCESSFUL!")
    print(f"SQL Server Version: {row[0]}")
    
    conn.close()
except pyodbc.Error as e:
    print("\n❌ CONNECTION FAILED!")
    print("Error Details:", e)
