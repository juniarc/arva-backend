from flask import jsonify, request, Blueprint
from models.products import Product
from models.shops import Shop
from models.category import Category
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
from connector.db import db
import datetime


product_bp = Blueprint('product_controller', __name__)

@product_bp.route('/<int:product_id>', methods=['GET'])
@jwt_required()
def get_products(product_id):
    
    try:
        products = db.session.query(Product).filter_by(product_id=product_id).first()
        if products is None:
            return jsonify({'error': 'Product not found'}), 404
        return jsonify(products.to_dict()), 200
    except Exception as e:
        return jsonify({'error': 'Failed to get product'}), 500
    

@product_bp.route('/allproducts', methods=['GET'])
def get_all_products():
    try:
        products = db.session.query(Product).all()
        return jsonify([product.to_dict() for product in products]), 200
    except Exception as e:
        return jsonify({'error': 'Failed to get all products'}), 500


@product_bp.route('/createproduct', methods=['POST'])
@jwt_required()
def create_product():
    data = request.get_json()
    current_user_id = int(get_jwt_identity())

    if data is None:
        return jsonify({'error': 'No data provided'}), 400
    elif 'product_name' not in data:
        return jsonify({'error': 'Missing product name'}), 400
    elif 'price' not in data:
        return jsonify({'error': 'Missing price'}), 400
    elif 'unit' not in data:
        return jsonify({'error': 'Missing unit'}), 400
    elif 'stock' not in data:
        return jsonify({'error': 'Missing stock'}), 400
    
    try:
        shop = db.session.query(Shop).filter_by(user_id=current_user_id).first()
        category = db.session.query(Category).filter_by(category_id=data['category_id']).first()

        if shop is None:
            return jsonify({'error': 'Shop not found'}), 404
        elif category is None:
            return jsonify({'error': 'Category not found'}), 404
        new_product = Product(
            product_name=data['product_name'],
            price=data['price'],
            unit=data['unit'],
            stock=data['stock'],
            category_id=data['category_id'],
            shop_id=shop.shop_id
        )
        db.session.add(new_product)
        db.session.commit()
        return jsonify({'message': 'Product created successfully'}), 201
    except Exception as e:
        return jsonify({'error': 'Failed to create product'}), 500
    

@product_bp.route('/<int:product_id>', methods=['PUT'])
@jwt_required()
def update_product(product_id):
    data = request.get_json()
    current_user_id = int(get_jwt_identity())

    if data is None:
        return jsonify({'error': 'No data provided'}), 400
    
    try:
        product = db.session.query(Product).filter_by(product_id=product_id).first()
        if product is None:
            return jsonify({'error': 'Product not found'}), 404
        if product.shop.user_id != current_user_id:
            return jsonify({'error': 'Unauthorized: Insufficient permissions'}), 401
        product.product_name = data.get('product_name', product.product_name)
        product.price = data.get('price', product.price)
        product.unit = data.get('unit', product.unit)
        product.stock = data.get('stock', product.stock)
        product.category_id = data.get('category_id', product.category_id)
        db.session.commit()
        return jsonify({'message': 'Product updated successfully'}), 200
    except Exception as e:
        return jsonify({'error': 'Failed to update product'}), 500
    

@product_bp.route('/<int:product_id>/deactivate', methods=['PUT'])
@jwt_required()
def deactivate_product(product_id):
    data = request.get_json()
    current_user_id = int(get_jwt_identity())

    if data is None:
        return jsonify({'error': 'No data provided'}), 400
    if 'status' not in data:
        return jsonify({'error': 'Missing status'}), 400
    
    try:
        product = db.session.query(Product).filter_by(product_id=product_id).first()
        if product is None:
            return jsonify({'error': 'Product not found'}), 404
        if product.shop.user_id != current_user_id:
            return jsonify({'error': 'Unauthorized: Insufficient permissions'}), 401
        product.status = data['status']
        db.session.commit()
        return jsonify({'message': 'Product deactivated successfully'}), 200
    except Exception as e:
        return jsonify({'error': 'Failed to deactivate product'}), 500