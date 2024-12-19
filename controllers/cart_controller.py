from flask import jsonify, request, Blueprint
from models.cart import Cart
from models.users import User
from models.products import Product
from models.shops import Shop
from models.variant import Variant
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
from connector.db import db



cart_bp = Blueprint('cart_controller', __name__)

@cart_bp.route('/addtocart', methods=['POST'])
@jwt_required()
def add_to_cart():
    current_user_id = int(get_jwt_identity())
    data = request.get_json()
    if data is None:
        return jsonify({'error': 'No data provided'}), 400
    elif 'product_id' not in data:
        return jsonify({'error': 'Missing product id'}), 400
    elif 'quantity' not in data:
        return jsonify({'error': 'Missing quantity'}), 400
    elif 'variant_id' not in data:
        return jsonify({'error': 'Missing variant id'}), 400

    try:
        user = db.session.query(User).filter_by(user_id=current_user_id).first()
        if user is None or user.status != 'active':
            return jsonify({'error': 'User not found'}), 404

        product = db.session.query(Product).filter_by(product_id=data['product_id']).first()
        if product is None:
            return jsonify({'error': 'Product not found'}), 404

        variant = db.session.query(Variant).filter_by(variant_id=data['variant_id']).first()
        if variant is None:
            return jsonify({'error': 'Variant not found'}), 404

        shop = db.session.query(Shop).filter_by(shop_id=product.shop_id).first()
        if shop is None or shop.status != 'active':
            return jsonify({'error': 'Shop not found'}), 404

        cart = Cart(user_id=current_user_id, product_id=data['product_id'], variant_id=data['variant_id'], quantity=data['quantity'])

        db.session.add(cart)
        db.session.commit()

        return jsonify({'message': 'Product added to cart successfully'}), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to add product to cart'}), 500
        
@cart_bp.route('/getcartbyuserid/<int:user_id>', methods=['GET'])
def get_cart_by_user_id(user_id):
    try:
        user = db.session.query(User).filter_by(user_id=user_id).first()
        if user is None or user.status != 'active':
            return jsonify({'error': 'User not found'}), 404

        cart = db.session.query(Cart).filter_by(user_id=user_id).all()
        return jsonify({'cart': [cart.to_dict() for cart in cart]}), 200

    except Exception as e:
        return jsonify({'error': 'Failed to get cart'}), 500
    
@cart_bp.route('/getallcart', methods=['GET'])
def get_all_cart():
    try:
        carts = db.session.query(Cart).all()

        return jsonify([cart.to_dict() for cart in carts]), 200
    except Exception as e:
        return jsonify({'error': f'Failed to get cart {e}'}), 500
    
@cart_bp.route('/removefromcart/<int:cart_id>', methods=['DELETE'])
@jwt_required()
def remove_from_cart(cart_id):
    current_user_id = int(get_jwt_identity())
    try:
        cart = db.session.query(Cart).filter_by(cart_id=cart_id).first()
        if cart is None:
            return jsonify({'error': 'Cart not found'}), 404
        elif cart.user_id != current_user_id:
            return jsonify({'error': 'Unauthorized: Insufficient permissions'}), 401
        db.session.delete(cart)
        db.session.commit()
        return jsonify({'message': 'Product removed from cart successfully'}), 200    
    except Exception as e:
        db.session.rollback()    
        return jsonify({'error': 'Failed to remove product from cart'}), 500


@cart_bp.route('/updatecart/<int:cart_id>', methods=['PUT'])
@jwt_required()
def update_cart(cart_id):
    data = request.get_json()
    current_user_id = int(get_jwt_identity())

    if data is None:
        return jsonify({'error': 'No data provided'}), 400
    elif 'quantity' not in data:
        return jsonify({'error': 'Missing quantity'}), 400

    try:
        cart = db.session.query(Cart).filter_by(cart_id=cart_id).first()
        if cart is None:
            return jsonify({'error': 'Cart not found'}), 404
        elif cart.user_id != current_user_id:
            return jsonify({'error': 'Unauthorized: Insufficient permissions'}), 401
        cart.quantity = data['quantity']
        db.session.commit()
        return jsonify({'message': 'Cart updated successfully'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to update cart'}), 500