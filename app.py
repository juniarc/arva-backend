from dotenv import load_dotenv
from flask import Flask, jsonify
from flask_cors import CORS
from connector.db import db
from flask_migrate import Migrate
import os
from flask_jwt_extended import JWTManager
from controllers.shop_controllers import shop_bp
from controllers.user_controllers import user_bp
from controllers.product_controller import product_bp
from controllers.image_product_controller import image_product_bp
from controllers.variant_controller import variant_bp
from controllers.category_controller import category_bp
from controllers.tag_controller import tag_bp
from controllers.tag_product_controller import tag_product_bp
from controllers.discount_controller import discount_bp
from controllers.order_controller import order_bp
from controllers.orderItem_controller import orderItem_Bp
from controllers.cart_controller import cart_bp
from controllers.rating_controller import rating_bp
from controllers.voucher_controller import voucher_bp
from controllers.wishlist_controller import wishlist_bp

load_dotenv()

app = Flask(__name__)
CORS(app)
# hai

app.config['JWT_SECRET_KEY'] = os.getenv('SECRET_KEY')  
jwt = JWTManager(app)

app.register_blueprint(tag_product_bp, url_prefix='/tag_product')
app.register_blueprint(tag_bp, url_prefix='/tag')
app.register_blueprint(category_bp, url_prefix='/category')
app.register_blueprint(variant_bp, url_prefix='/variant')
app.register_blueprint(image_product_bp, url_prefix='/image_product')
app.register_blueprint(product_bp, url_prefix='/product')
app.register_blueprint(shop_bp, url_prefix='/shop')
app.register_blueprint(user_bp, url_prefix='/user')
app.register_blueprint(discount_bp, url_prefix='/discount')
app.register_blueprint(order_bp, url_prefix='/order')
app.register_blueprint(orderItem_Bp, url_prefix='/orderitem')
app.register_blueprint(cart_bp, url_prefix='/cart')
app.register_blueprint(rating_bp, url_prefix='/rating')
app.register_blueprint(voucher_bp, url_prefix='/voucher')
app.register_blueprint(wishlist_bp, url_prefix='/wishlist')


app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv("POSTGRES_CONNECTION_STRING")
if not app.config['SQLALCHEMY_DATABASE_URI']:
    raise RuntimeError("Environment variable 'POSTGRES_CONNECTION_STRING' not set!")
print(f"Database URI: {app.config['SQLALCHEMY_DATABASE_URI']}")
print(os.getenv("POSTGRES_CONNECTION_STRING"))
db.init_app(app)
migrate = Migrate(app, db)

with app.app_context():
    db.create_all()

@app.route("/")
def index():
    return jsonify({
        'message': "Hello, World!",
        'status': 'Live'
        }), 200



if __name__ == "__main__":
    app.run(debug=True)
