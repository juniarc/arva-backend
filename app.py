from flask import Flask, jsonify
from connector.db import db
from flask_migrate import Migrate
import os
from flask_jwt_extended import JWTManager
from models.shops import Shop
from models.users import User
from models.products import Product
from models.image_product import ImageProduct
from models.variant import Variant
from controllers.shop_controllers import shop_bp
from controllers.user_controllers import user_bp
from controllers.product_controller import product_bp
from controllers.image_product_controller import image_product_bp
from controllers.variant_controller import variant_bp



app = Flask(__name__)


app.config['JWT_SECRET_KEY'] = os.getenv('SECRET_KEY')  
jwt = JWTManager(app)

app.register_blueprint(variant_bp, url_prefix='/variant')
app.register_blueprint(image_product_bp, url_prefix='/image_product')
app.register_blueprint(product_bp, url_prefix='/product')
app.register_blueprint(shop_bp, url_prefix='/shop')
app.register_blueprint(user_bp, url_prefix='/user')

app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv("POSTGRES_CONNECTION_STRING")
if not app.config['SQLALCHEMY_DATABASE_URI']:
    raise RuntimeError("Environment variable 'POSTGRES_CONNECTION_STRING' not set!")


db.init_app(app)
migrate = Migrate(app, db)


print(f"Database URI: {app.config['SQLALCHEMY_DATABASE_URI']}")
print(os.getenv("POSTGRES_CONNECTION_STRING"))


@app.route("/")
def index():
    return jsonify({
        'message': "Hello, World!",
        'status': 'Live'
        }), 200



if __name__ == "__main__":
    app.run(debug=True)
